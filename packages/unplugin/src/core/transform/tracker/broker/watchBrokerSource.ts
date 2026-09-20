/**
 * The program the isolated watch process runs.
 *
 * Every registration opens its locations' watches in the child and reports
 * `ready` once they are open, every event goes back with the registration's id,
 * and a `drain` is answered once every event queued before it has been sent.
 * Each registration owns its watches, so opening or closing one disturbs no
 * other.
 *
 * On Windows the watches are `fs.watch`, whose completions the kernel queues,
 * so a drain is answered after two turns of the child's loop: the first lets
 * the loop poll for completions already queued, the second runs after their
 * callbacks.
 *
 * On macOS the watches go through the `fsevents` binding, one FSEventStream
 * each, instead of `fs.watch` (samchon/ttsc#1425). libuv serves all directory
 * watches of one loop through a single stream it re-creates whenever one opens
 * or closes, losing the events in between (samchon/ttsc#1418), and it discards
 * every event that carries a dropped-events flag. The binding starts each
 * stream inside `watch()` and passes every flag through, so the child:
 *
 * - Reports `ready` once `watch()` has returned for every location;
 * - Maps each event's flags to the event type libuv would report, and drops what
 *   a non-recursive watch would not hear;
 * - Sends `gap` to the registration whose stream reports a drop, a wrapped event
 *   id, a changed root, a mount or unmount, or a path it cannot place, since
 *   events of that stream may have been lost.
 *
 * FSEvents delivers with a latency (the binding creates each stream with 0.1
 * s), so turns of the loop prove nothing there (samchon/ttsc#1453). FSEvents
 * does preserve order within one stream, so a location that names a probe
 * directory, one the parent owns below the stream's root, is proven on `drain`
 * by writing a probe there and hearing it on that stream: every earlier event
 * of the stream has arrived by then. Such a stream is opened at the probe's
 * root, not at the location, and its events are placed against the location; a
 * stream with no probe cannot be proven, and the drain names its registration
 * as unproven.
 *
 * Without the binding, a macOS watch can lose events silently, so the child
 * reports every registration failed instead.
 *
 * @param fsevents Where the `fsevents` binding is, on macOS. `null` when it
 *   cannot be loaded there, and `undefined` on every other platform.
 */
export function watchBrokerSource(fsevents?: string | null): string {
  return `const fseventsPath = ${fsevents === undefined ? "undefined" : JSON.stringify(fsevents)};\n${WATCH_BROKER_PROGRAM}`;
}

/**
 * The child program, as CommonJS text for `node -e`. It carries no template
 * literal, so it can be embedded verbatim.
 */
const WATCH_BROKER_PROGRAM = String.raw`const fs = require("node:fs");
const path = require("node:path");

// Registration id -> { closers, streams }.
const registrations = new Map();
// The fsevents flags (CoreServices' kFSEventStreamEventFlag* values). A stream
// that reports any of DROPPED may have lost events. libuv reports CHANGE for an
// event that modified an item without creating, removing, or renaming one, and
// RENAME for every other.
const DROPPED = 0x1 | 0x2 | 0x4 | 0x8 | 0x20 | 0x40 | 0x80;
const MODIFIED = 0x400 | 0x1000 | 0x2000 | 0x4000 | 0x8000;
const RENAMED = 0x100 | 0x200 | 0x800;
const fsevents = load();
let probeSequence = 0;

process.on("message", (message) => {
  if (message.op === "drain") {
    drain(message.id);
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
  process.exit(0);
});

function load() {
  if (typeof fseventsPath !== "string") return undefined;
  try {
    return require(fseventsPath);
  } catch {
    return undefined;
  }
}

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
  const registration = { closers: [], streams: [] };
  registrations.set(message.id, registration);
  // A macOS watch without the binding can lose events silently.
  let failed = fseventsPath === null || (typeof fseventsPath === "string" && fsevents === undefined);
  for (const location of message.locations) {
    if (failed) break;
    const deliver = subscriber(message, location);
    try {
      if (fsevents === undefined) {
        registration.closers.push(watch(location, deliver, message.id));
      } else {
        const opened = stream(location, deliver, message.id);
        registration.closers.push(opened.close);
        registration.streams.push(opened);
      }
    } catch {
      failed = true;
    }
  }
  process.send?.({ failed, id: message.id, ready: true });
}

function watch(location, deliver, id) {
  const watcher = fs.watch(location.directory, { persistent: false, recursive: location.recursive === true }, deliver);
  watcher.on("error", () => process.send?.({ failed: true, id }));
  return () => watcher.close();
}

// FSEvents reports the real path of what changed, so events are placed below
// the real path of the location, and the stream is opened at the real path of
// the probe's root when the location has one.
function stream(location, deliver, id) {
  const directory = fs.realpathSync.native(location.directory);
  // The probe directory need not exist yet; it is placed below the root's real
  // path by the same relative path.
  const probe = location.probe === undefined ? undefined : (() => {
    const root = fs.realpathSync.native(location.probe.root);
    return { directory: path.join(root, path.relative(location.probe.root, location.probe.directory)), root };
  })();
  const root = probe === undefined ? directory : probe.root;
  const within = (parent, file) => file === parent || file.startsWith(parent.endsWith("/") ? parent : parent + "/");
  const opened = { close: undefined, pending: new Map(), probe };
  const stop = fsevents.watch(root, (file, flags) => {
    if ((flags & DROPPED) !== 0) {
      process.send?.({ gap: true, id });
      return;
    }
    // A probe of a drain in flight: the stream has delivered everything
    // before it.
    if (probe !== undefined && within(probe.directory, file)) {
      const waiting = opened.pending.get(path.basename(file));
      if (waiting !== undefined) {
        opened.pending.delete(path.basename(file));
        waiting();
      }
      return;
    }
    // The watched directory's own events say nothing about its entries, and
    // its replacement arrives as a changed root.
    if (file === directory) return;
    if (!within(directory, file)) {
      // Below the stream's root but outside the location: another location's
      // business, or the root's own event. Outside the root: the stream
      // cannot place it.
      if (!within(root, file)) process.send?.({ gap: true, id });
      return;
    }
    const filename = file.slice(directory.length + 1);
    if (location.recursive !== true && filename.includes("/")) return;
    deliver((flags & MODIFIED) !== 0 && (flags & RENAMED) === 0 ? "change" : "rename", filename);
  });
  opened.close = () => {
    Promise.resolve(stop()).catch(() => undefined);
  };
  return opened;
}

// Answer once every stream that can be proven has delivered a probe written
// now; name the registrations of the streams that cannot.
function drain(requestId) {
  const unproven = new Set();
  let outstanding = 0;
  const settle = () => {
    outstanding -= 1;
    if (outstanding === 0) process.send?.({ drained: true, id: requestId, unproven: [...unproven] });
  };
  for (const [id, registration] of registrations) {
    for (const opened of registration.streams) {
      if (opened.probe === undefined) {
        unproven.add(id);
        continue;
      }
      probeSequence += 1;
      const name = "probe-" + process.pid + "-" + probeSequence;
      outstanding += 1;
      opened.pending.set(name, () => {
        fs.rm(path.join(opened.probe.directory, name), { force: true }, () => undefined);
        settle();
      });
      try {
        fs.mkdirSync(opened.probe.directory, { recursive: true });
        fs.writeFileSync(path.join(opened.probe.directory, name), String(requestId));
      } catch {
        // The probe cannot be written, so this stream cannot be proven now.
        opened.pending.delete(name);
        unproven.add(id);
        outstanding -= 1;
      }
    }
  }
  // Windows watches, and streams already proven, answer after two turns: the
  // first lets the loop poll for completions the kernel had already queued,
  // the second answers after their callbacks.
  outstanding += 1;
  setImmediate(() => setImmediate(settle));
}

function remove(id) {
  const registration = registrations.get(id);
  if (registration === undefined) return;
  registrations.delete(id);
  for (const close of registration.closers) {
    try {
      close();
    } catch {}
  }
}
`;
