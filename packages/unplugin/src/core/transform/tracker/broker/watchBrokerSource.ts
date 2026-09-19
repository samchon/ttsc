/**
 * The program the isolated watch process runs.
 *
 * Every registration opens its locations' watches in the child and reports
 * `ready` once they hear, every event goes back with the registration's id, and
 * a `drain` is answered after two turns of the child's loop.
 *
 * With `shared`, which macOS needs (samchon/ttsc#1418), native watches are
 * shared and every change to them is proven. libuv serves all directory watches
 * of one loop through a single FSEventStream and re-creates it whenever one
 * opens or closes. The old stream stops without a flush and the new one starts
 * at "now", so events in between are lost for every watch of the loop. The
 * child therefore:
 *
 * - Keeps one native watch per directory and recursion, shared by every
 *   registration that needs it, and leaves an unreferenced one open until
 *   `HANDLE_BOUND` is passed, so a later generation over the same project
 *   reuses live watches and causes no swap;
 * - Answers `ready` for a registration that caused a swap only after a probe
 *   proves the new stream live: a fresh probe directory is watched in the same
 *   swap, and its first event can only come from a stream that contains every
 *   watch opened before it;
 * - After each proven swap, sends `gap` to every registration that was already
 *   live when the swap began, since its events may have been lost.
 *
 * Without `shared`, as on Windows, each registration owns its watches, which
 * lose nothing when another opens or closes, and is ready as soon as they are
 * open.
 *
 * @param shared Whether to share native watches and prove every swap.
 */
export function watchBrokerSource(shared: boolean): string {
  return `const shared = ${shared ? "true" : "false"};\n${WATCH_BROKER_PROGRAM}`;
}

/**
 * The child program, as CommonJS text for `node -e`. It carries no template
 * literal, so it can be embedded verbatim.
 */
const WATCH_BROKER_PROGRAM = String.raw`const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Registration id -> { live, subscriptions, watchers }.
const registrations = new Map();
// Shared mode: one native watch per recursion and directory.
const handles = new Map();
// Unreferenced shared watches kept open before the oldest are closed.
const HANDLE_BOUND = 256;
// A probe writes every PROBE_INTERVAL_MS until heard, PROBE_ATTEMPTS times.
const PROBE_INTERVAL_MS = 10;
const PROBE_ATTEMPTS = 500;
const PROBE_PREFIX = "ttsc-watch-probe-";
// The proof in flight, and the probe of the last settled one, kept open until
// the next swap retires it inside that same swap.
let proof;
let settledProbe;

if (shared) sweepProbes();

process.on("message", (message) => {
  if (message.op === "drain") {
    // Two turns, not one: the first lets the loop poll for watch completions
    // the kernel had already queued, the second answers after their callbacks.
    setImmediate(() => setImmediate(() => process.send?.({ drained: true, id: message.id })));
    return;
  }
  if (message.op === "remove") {
    remove(message.id);
    return;
  }
  if (message.op === "add") add(message);
});
process.on("disconnect", () => {
  for (const id of [...registrations.keys()]) remove(id);
  retire(proof);
  retire(settledProbe);
  process.exit(0);
});

function subscriber(message, location) {
  const names = location.names === undefined ? undefined : new Set(location.names.map((name) => name.toLowerCase()));
  return (event, filename) => {
    const matches = names === undefined || filename === null || names.has(String(filename).toLowerCase());
    // An event without a name is a backend's notice that anything below the
    // directory may have changed, such as a Windows buffer overflow, so every
    // registration hears it, whichever events it asked for.
    if (matches && (message.allEvents || event === "rename" || filename === null || location.recursive === true)) {
      process.send?.({ directory: location.directory, eventType: event, filename: filename === null ? null : String(filename), id: message.id });
    }
  };
}

function add(message) {
  const registration = { live: false, subscriptions: [], watchers: [] };
  registrations.set(message.id, registration);
  let failed = false;
  let swapped = false;
  for (const location of message.locations) {
    const deliver = subscriber(message, location);
    if (!shared) {
      try {
        const watcher = fs.watch(location.directory, { persistent: false, recursive: location.recursive === true }, deliver);
        watcher.on("error", () => process.send?.({ failed: true, id: message.id }));
        registration.watchers.push(watcher);
      } catch {
        failed = true;
      }
      continue;
    }
    const key = (location.recursive === true ? "r" : "d") + "\0" + location.directory;
    let handle = handles.get(key);
    if (handle === undefined) {
      try {
        handle = open(key, location);
      } catch {
        failed = true;
        continue;
      }
      swapped = true;
    }
    const entry = { deliver, id: message.id };
    handle.subscribers.add(entry);
    registration.subscriptions.push({ entry, handle });
  }
  if (swapped) {
    swap(live(), [{ failed, id: message.id }]);
  } else if (proof !== undefined) {
    // Reused watches a pending swap opened are live only once it is proven.
    proof.ready.push({ failed, id: message.id });
  } else {
    registration.live = true;
    process.send?.({ failed, id: message.id, ready: true });
  }
}

function open(key, location) {
  const handle = { released: 0, subscribers: new Set(), watcher: undefined };
  handle.watcher = fs.watch(location.directory, { persistent: false, recursive: location.recursive === true }, (event, filename) => {
    for (const entry of [...handle.subscribers]) entry.deliver(event, filename);
  });
  handle.watcher.on("error", () => {
    if (handles.get(key) !== handle) return;
    handles.delete(key);
    for (const entry of handle.subscribers) process.send?.({ failed: true, id: entry.id });
    handle.subscribers.clear();
    try {
      handle.watcher.close();
    } catch {}
    swap(live(), []);
  });
  handles.set(key, handle);
  return handle;
}

function remove(id) {
  const registration = registrations.get(id);
  if (registration === undefined) return;
  registrations.delete(id);
  for (const watcher of registration.watchers) watcher.close();
  const now = Date.now();
  for (const { entry, handle } of registration.subscriptions) {
    handle.subscribers.delete(entry);
    if (handle.subscribers.size === 0) handle.released = now;
  }
  if (!shared || handles.size <= HANDLE_BOUND) return;
  // Past the bound the oldest unreferenced watches close, which is a swap.
  const idle = [...handles].filter((pair) => pair[1].subscribers.size === 0).sort((left, right) => left[1].released - right[1].released);
  let closed = false;
  for (const [key, handle] of idle) {
    if (handles.size <= HANDLE_BOUND) break;
    handles.delete(key);
    try {
      handle.watcher.close();
    } catch {}
    closed = true;
  }
  if (closed) swap(live(), []);
}

function live() {
  const ids = [];
  for (const [id, registration] of registrations) if (registration.live) ids.push(id);
  return ids;
}

// Prove the stream re-created by the watches just opened or closed. Waiters of
// a proof still in flight move to this one, since its probe closes here.
function swap(gaps, ready) {
  const previous = proof;
  const next = {
    attempts: 0,
    directory: undefined,
    gaps: new Set(previous === undefined ? gaps : [...previous.gaps, ...gaps]),
    heard: false,
    ready: previous === undefined ? ready : [...previous.ready, ...ready],
    watcher: undefined,
  };
  try {
    // Watched by its real spelling: a short or linked temporary directory
    // reports entries under another name than the one it was opened with.
    next.directory = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), PROBE_PREFIX + process.pid + "-")));
    next.watcher = fs.watch(next.directory, { persistent: false }, () => {
      next.heard = true;
    });
  } catch {
    next.attempts = PROBE_ATTEMPTS;
  }
  retire(previous);
  retire(settledProbe);
  settledProbe = undefined;
  proof = next;
  poll(next);
}

function poll(current) {
  if (proof !== current) return;
  if (current.heard || current.attempts >= PROBE_ATTEMPTS) {
    settle(current, !current.heard);
    return;
  }
  current.attempts += 1;
  try {
    fs.writeFileSync(path.join(current.directory, "probe"), String(current.attempts));
  } catch {}
  setTimeout(() => poll(current), PROBE_INTERVAL_MS);
}

function settle(current, unproven) {
  proof = undefined;
  settledProbe = current;
  const readied = new Set();
  for (const { failed, id } of current.ready) {
    const registration = registrations.get(id);
    if (registration === undefined) continue;
    registration.live = true;
    readied.add(id);
    // A stream that never proved live cannot vouch for silence.
    process.send?.({ failed: failed || unproven, id, ready: true });
  }
  for (const id of current.gaps) {
    if (!readied.has(id) && registrations.get(id)?.live === true) process.send?.({ gap: true, id });
  }
}

function retire(probe) {
  if (probe === undefined) return;
  try {
    probe.watcher?.close();
  } catch {}
  if (probe.directory !== undefined) fs.rmSync(probe.directory, { force: true, recursive: true });
}

// Remove probe directories a broker left behind when it was killed.
function sweepProbes() {
  let entries;
  try {
    entries = fs.readdirSync(os.tmpdir());
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.startsWith(PROBE_PREFIX)) continue;
    const owner = Number.parseInt(entry.slice(PROBE_PREFIX.length), 10);
    if (!Number.isInteger(owner) || owner <= 0 || owner === process.pid) continue;
    try {
      process.kill(owner, 0);
      continue;
    } catch (error) {
      if (error.code !== "ESRCH") continue;
    }
    try {
      fs.rmSync(path.join(os.tmpdir(), entry), { force: true, recursive: true });
    } catch {}
  }
}
`;
