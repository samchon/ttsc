import { WATCH_PROBE_TIMEOUT_MS } from "./WATCH_PROBE_TIMEOUT_MS";

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
 * - Maps each event's flags to the event type libuv would report, and drops what
 *   a non-recursive watch would not hear;
 * - Sends `gap` to the registration whose stream reports a drop, a wrapped event
 *   id, a changed root, a mount or unmount, or a path it cannot place, since
 *   events of that stream may have been lost.
 *
 * FSEvents delivers with a latency (the binding creates each stream with 0.1
 * s), so turns of the loop prove nothing there, and a stream created now still
 * delivers events of writes made just before, which the service had not yet
 * logged (samchon/ttsc#1453, samchon/ttsc#1454). FSEvents does preserve order
 * within one stream, so a location that names a probe directory, one the parent
 * owns below the stream's root, is proven by writing a probe there and hearing
 * it on that stream: every earlier event of the stream has arrived by then, and
 * nothing heard before it belongs to the time after the probe was written. Such
 * a stream is opened at the probe's root, not at the location, and its events
 * are placed against the location. The child writes one probe when the stream
 * opens, and reports `ready` only once it is heard, discarding what arrived
 * before it as the past; and one per `drain`, answering once it is heard. A
 * probe that is not heard within the probe timeout says the stream does not
 * deliver, so the child closes it and reports the registration failed. A stream
 * with no probe cannot be proven, and the drain names its location as
 * unproven.
 *
 * Without the binding, a macOS watch can lose events silently, so the child
 * reports every registration failed instead.
 *
 * @param fsevents Where the `fsevents` binding is, on macOS. `null` when it
 *   cannot be loaded there, and `undefined` on every other platform.
 */
export function watchBrokerSource(fsevents?: string | null): string {
  return `const fseventsPath = ${fsevents === undefined ? "undefined" : JSON.stringify(fsevents)};\nconst probeTimeoutMs = ${WATCH_PROBE_TIMEOUT_MS};\n${WATCH_BROKER_PROGRAM}`;
}

/**
 * The child program, as CommonJS text for `node -e`. It carries no template
 * literal, so it can be embedded verbatim.
 */
const WATCH_BROKER_PROGRAM = String.raw`const fs = require("node:fs");
const path = require("node:path");

// Registration id -> { closers, opening, streams }.
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
  const registration = { closers: [], id: message.id, opening: 0, streams: [] };
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
        const opened = stream(location, deliver, registration);
        registration.closers.push(opened.close);
        registration.streams.push(opened);
      }
    } catch {
      failed = true;
    }
  }
  // A probed stream reports ready once its opening probe is heard.
  if (failed || registration.opening === 0) process.send?.({ failed, id: message.id, ready: true });
}

function watch(location, deliver, id) {
  const watcher = fs.watch(location.directory, { persistent: false, recursive: location.recursive === true }, deliver);
  watcher.on("error", () => process.send?.({ failed: true, id }));
  return () => watcher.close();
}

// FSEvents reports the real path of what changed, so events are placed below
// the real path of the location, and the stream is opened at the real path of
// the probe's root when the location has one.
function stream(location, deliver, registration) {
  const id = registration.id;
  const directory = fs.realpathSync.native(location.directory);
  // The probe directory need not exist yet; it is placed below the root's real
  // path by the same relative path.
  const probe = location.probe === undefined ? undefined : (() => {
    const root = fs.realpathSync.native(location.probe.root);
    return { directory: path.join(root, path.relative(location.probe.root, location.probe.directory)), root };
  })();
  const root = probe === undefined ? directory : probe.root;
  const within = (parent, file) => file === parent || file.startsWith(parent.endsWith("/") ? parent : parent + "/");
  const opened = { close: undefined, location: location.directory, pending: new Map(), probe, proven: probe === undefined };
  const stop = fsevents.watch(root, (file, flags) => {
    // A probe of this stream: everything before it has been delivered.
    if (probe !== undefined && within(probe.directory, file)) {
      const waiting = opened.pending.get(path.basename(file));
      if (waiting !== undefined) {
        opened.pending.delete(path.basename(file));
        waiting.heard();
      }
      return;
    }
    if ((flags & DROPPED) !== 0) {
      process.send?.({ gap: true, id });
      return;
    }
    // Before the opening probe, the stream still delivers the past.
    if (!opened.proven) return;
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
    const pending = [...opened.pending.values()];
    opened.pending.clear();
    for (const entry of pending) entry.abandon();
    Promise.resolve(stop()).catch(() => undefined);
  };
  if (probe !== undefined) {
    registration.opening += 1;
    const written = writeProbe(opened, registration, () => {
      opened.proven = true;
      registration.opening -= 1;
      if (registration.opening === 0) process.send?.({ failed: false, id, ready: true });
    }, () => undefined);
    // A probe that cannot be written leaves the stream unprovable: it opens
    // all the same, and every drain names it unproven.
    if (!written) {
      registration.opening -= 1;
      opened.probe = undefined;
      opened.proven = true;
    }
  }
  return opened;
}

// Expect one probe on a stream, and call heard() once the stream delivers it
// or missed() once it will not: the probe timed out, which says the stream does
// not deliver, so the registration is reported failed and its streams closed;
// or the stream was closed first.
function expectProbe(opened, registration, name, heard, missed) {
  const file = path.join(opened.probe.directory, name);
  const entry = {
    abandon: () => {
      clearTimeout(entry.timer);
      missed();
    },
    heard: () => {
      clearTimeout(entry.timer);
      fs.rm(file, { force: true }, () => undefined);
      heard();
    },
    timer: setTimeout(() => {
      if (opened.pending.get(name) !== entry) return;
      opened.pending.delete(name);
      fs.rm(file, { force: true }, () => undefined);
      process.send?.({ failed: true, id: registration.id, ready: true });
      remove(registration.id);
      entry.abandon();
    }, probeTimeoutMs),
  };
  entry.timer.unref?.();
  opened.pending.set(name, entry);
  return entry;
}

// Write one probe file below a probe directory, for every stream expecting it.
function writeProbeFile(directory, name) {
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, name), String(process.pid));
    return true;
  } catch {
    return false;
  }
}

// Write one probe per stream at its opening; call back whether it was written.
function writeProbe(opened, registration, heard, missed) {
  probeSequence += 1;
  const name = "probe-" + process.pid + "-" + probeSequence;
  const entry = expectProbe(opened, registration, name, heard, missed);
  if (writeProbeFile(opened.probe.directory, name)) return true;
  clearTimeout(entry.timer);
  opened.pending.delete(name);
  return false;
}

// Answer once every stream that can be proven has delivered a probe written
// now; name the locations of the streams that cannot. Streams rooted at one
// probe directory, every tracker of a project among them, share one probe file,
// which each of them hears on its own stream.
function drain(requestId) {
  const unproven = [];
  let outstanding = 0;
  const settle = () => {
    outstanding -= 1;
    if (outstanding === 0) process.send?.({ drained: true, id: requestId, unproven });
  };
  probeSequence += 1;
  const name = "probe-" + process.pid + "-" + probeSequence;
  const directories = new Map();
  for (const [id, registration] of registrations) {
    for (const opened of registration.streams) {
      if (opened.probe === undefined) {
        unproven.push({ directory: opened.location, id });
        continue;
      }
      outstanding += 1;
      const entry = expectProbe(opened, registration, name, settle, () => {
        unproven.push({ directory: opened.location, id });
        settle();
      });
      const expecting = directories.get(opened.probe.directory) ?? [];
      expecting.push({ entry, name, opened });
      directories.set(opened.probe.directory, expecting);
    }
  }
  for (const [directory, expecting] of directories) {
    if (writeProbeFile(directory, name)) continue;
    // The probe cannot be written there, so these streams cannot be proven.
    for (const { entry, opened } of expecting) {
      clearTimeout(entry.timer);
      opened.pending.delete(name);
      opened.probe = undefined;
      entry.abandon();
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
