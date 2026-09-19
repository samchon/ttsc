/**
 * The program the isolated watch process runs.
 *
 * Every registration opens its locations' watches in the child and reports
 * `ready` once they are open, every event goes back with the registration's id,
 * and a `drain` is answered after two turns of the child's loop. Each
 * registration owns its watches, so opening or closing one disturbs no other.
 *
 * On macOS the watches go through the `fsevents` binding, one FSEventStream
 * each, instead of `fs.watch` (samchon/ttsc#1425). libuv serves all directory
 * watches of one loop through a single stream it re-creates whenever one opens
 * or closes, losing the events in between (samchon/ttsc#1418), and it discards
 * every event that carries a dropped-events flag. So a watch opened through
 * `fs.watch` could lose events without any notice. The binding starts each
 * stream inside `watch()` and passes every flag through, so the child:
 *
 * - Reports `ready` once `watch()` has returned for every location;
 * - Maps each event's flags to the event type libuv would report, and drops what
 *   a non-recursive watch would not hear;
 * - Sends `gap` to the registration whose stream reports a drop, a wrapped event
 *   id, a changed root, a mount or unmount, or a path it cannot place, since
 *   events of that stream may have been lost.
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

// Registration id -> the closers of its watches.
const registrations = new Map();
// The fsevents flags (CoreServices' kFSEventStreamEventFlag* values). A stream
// that reports any of DROPPED may have lost events. libuv reports CHANGE for an
// event that modified an item without creating, removing, or renaming one, and
// RENAME for every other.
const DROPPED = 0x1 | 0x2 | 0x4 | 0x8 | 0x20 | 0x40 | 0x80;
const MODIFIED = 0x400 | 0x1000 | 0x2000 | 0x4000 | 0x8000;
const RENAMED = 0x100 | 0x200 | 0x800;
const fsevents = load();

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
  const closers = [];
  registrations.set(message.id, closers);
  // A macOS watch without the binding can lose events silently.
  let failed = fseventsPath === null || (typeof fseventsPath === "string" && fsevents === undefined);
  for (const location of message.locations) {
    if (failed) break;
    const deliver = subscriber(message, location);
    try {
      closers.push(fsevents === undefined ? watch(location, deliver, message.id) : stream(location, deliver, message.id));
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
// the watched directory's real path.
function stream(location, deliver, id) {
  const root = fs.realpathSync.native(location.directory);
  const prefix = root.endsWith("/") ? root : root + "/";
  const stop = fsevents.watch(root, (file, flags) => {
    if ((flags & DROPPED) !== 0) {
      process.send?.({ gap: true, id });
      return;
    }
    // The watched directory's own events say nothing about its entries, and
    // its replacement arrives as a changed root.
    if (file === root) return;
    if (!file.startsWith(prefix)) {
      process.send?.({ gap: true, id });
      return;
    }
    const filename = file.slice(prefix.length);
    if (location.recursive !== true && filename.includes("/")) return;
    deliver((flags & MODIFIED) !== 0 && (flags & RENAMED) === 0 ? "change" : "rename", filename);
  });
  return () => {
    Promise.resolve(stop()).catch(() => undefined);
  };
}

function remove(id) {
  const closers = registrations.get(id);
  if (closers === undefined) return;
  registrations.delete(id);
  for (const close of closers) {
    try {
      close();
    } catch {}
  }
}
`;
