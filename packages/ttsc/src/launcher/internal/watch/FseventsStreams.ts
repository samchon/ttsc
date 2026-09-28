import { EventEmitter } from "node:events";
import path from "node:path";

import type { DirectoryWatcher } from "./DirectoryWatcher";

/**
 * The FSEventStreams serving this process's macOS directory watches.
 *
 * A stream covers its root recursively. Watches below an open stream join it;
 * opening an ancestor starts its stream before retiring the descendant streams.
 * Each transferred watch then re-reads its inputs once, because the binding
 * aborts callbacks still queued on a stream when it stops. Stream roots and
 * their descendants are indexed, so registration, close, and named event
 * delivery depend on path depth and affected watches rather than every stream
 * in the process.
 */
export class FseventsStreams {
  private readonly descendants = new Map<string, Set<Stream>>();
  private readonly streams = new Map<string, Stream>();

  /** Use the binding supplied by the host for every stream in this registry. */
  public constructor(private readonly binding: FseventsBinding) {}

  /** Load the optional binding, or warn once and return `null` without it. */
  public static load(): FseventsStreams | null {
    try {
      const loaded: unknown = require("fsevents");
      if (
        typeof loaded !== "object" ||
        loaded === null ||
        !("watch" in loaded) ||
        typeof loaded.watch !== "function"
      ) {
        throw new TypeError("fsevents does not expose watch()");
      }
      return new FseventsStreams(loaded as FseventsBinding);
    } catch {
      process.emitWarning(
        "the optional `fsevents` package could not be loaded, so `ttsc --watch` watches through `fs.watch`, which on macOS can lose events without notice. Reinstall ttsc without omitting optional dependencies.",
        { code: "TTSC_WATCH_FSEVENTS_UNAVAILABLE" },
      );
      return null;
    }
  }

  /**
   * Open one directory watch, joining an ancestor stream where one exists.
   *
   * @param location The physical directory to watch.
   * @param recursive Whether to receive events below immediate children.
   * @param listener Receives the event and its relative name, or `null` with a
   *   gap flag when every affected input needs a content recheck.
   * @returns A watcher whose close is idempotent.
   */
  public open(
    location: string,
    recursive: boolean,
    listener: Watch["listener"],
  ): DirectoryWatcher {
    const directory = path.resolve(location);
    const stream = this.streamFor(directory);
    const watch: Watch = {
      active: true,
      directory,
      emitter: new EventEmitter(),
      listener,
      recursive,
      stream,
    };
    addWatch(stream, watch);
    return {
      close: () => this.close(watch),
      on: (event, handler) => watch.emitter.on(event, handler),
    };
  }

  /** Find an ancestor stream, or start one and transfer its descendants. */
  private streamFor(directory: string): Stream {
    for (let ancestor = directory; ; ancestor = path.dirname(ancestor)) {
      const found = this.streams.get(ancestor);
      if (found !== undefined) return found;
      if (path.dirname(ancestor) === ancestor) break;
    }

    const displaced = [...(this.descendants.get(directory) ?? [])];
    const stream: Stream = {
      active: true,
      root: directory,
      stop: () => undefined,
      watches: new Map(),
    };
    // The old streams still serve their watches if opening this one fails.
    stream.stop = this.binding.watch(directory, (file, flags) =>
      deliver(stream, file, flags),
    );
    const transferred = new Set<Watch>();
    for (const old of displaced) {
      for (const watches of old.watches.values()) {
        for (const watch of watches) {
          addWatch(stream, watch);
          transferred.add(watch);
        }
      }
      old.watches.clear();
      old.active = false;
      this.unregisterStream(old);
    }
    this.registerStream(stream);
    for (const old of displaced) stopStream(old);

    if (transferred.size !== 0) {
      queueMicrotask(() => {
        // The binding aborts callbacks queued on a stopped stream. The new
        // stream reports later events, so one read closes that handoff window.
        for (const watch of transferred) {
          if (watch.active && watch.stream === stream) {
            watch.listener("rename", null, true);
          }
        }
      });
    }
    return stream;
  }

  private close(watch: Watch): void {
    if (!watch.active) return;
    watch.active = false;
    const stream = watch.stream;
    const watches = stream.watches.get(watch.directory);
    watches?.delete(watch);
    if (watches?.size === 0) stream.watches.delete(watch.directory);
    if (stream.watches.size !== 0) return;
    stream.active = false;
    this.unregisterStream(stream);
    stopStream(stream);
  }

  private registerStream(stream: Stream): void {
    this.streams.set(stream.root, stream);
    for (const ancestor of strictAncestors(stream.root)) {
      const descendants = this.descendants.get(ancestor) ?? new Set<Stream>();
      descendants.add(stream);
      this.descendants.set(ancestor, descendants);
    }
  }

  private unregisterStream(stream: Stream): void {
    this.streams.delete(stream.root);
    for (const ancestor of strictAncestors(stream.root)) {
      const descendants = this.descendants.get(ancestor);
      descendants?.delete(stream);
      if (descendants?.size === 0) this.descendants.delete(ancestor);
    }
  }
}

/** The part of the `fsevents` binding used for directory observation. */
type FseventsBinding = {
  watch(
    root: string,
    handler: (file: string, flags: number) => void,
  ): () => unknown;
};

type Watch = {
  active: boolean;
  directory: string;
  emitter: EventEmitter;
  listener: (
    event: "change" | "rename",
    filename: string | null,
    gap?: boolean,
  ) => void;
  recursive: boolean;
  stream: Stream;
};

type Stream = {
  active: boolean;
  root: string;
  stop: () => unknown;
  watches: Map<string, Set<Watch>>;
};

/** FSEvents flags that say the stream may have lost events. */
const GAP = 0x1 | 0x2 | 0x4 | 0x8 | 0x20 | 0x40 | 0x80;
const MODIFIED = 0x400 | 0x1000 | 0x2000 | 0x4000 | 0x8000;
const RENAMED = 0x100 | 0x200 | 0x800;

function addWatch(stream: Stream, watch: Watch): void {
  const watches = stream.watches.get(watch.directory) ?? new Set<Watch>();
  watches.add(watch);
  watch.stream = stream;
  stream.watches.set(watch.directory, watches);
}

function stopStream(stream: Stream): void {
  try {
    Promise.resolve(stream.stop()).catch(() => undefined);
  } catch {
    // A failed stop cannot be repaired after the stream lost its subscribers.
  }
}

/** Deliver one event to its parent watch and recursive ancestor watches. */
function deliver(stream: Stream, file: string, flags: number): void {
  if (!stream.active) return;
  if ((flags & GAP) !== 0) {
    deliverGap(stream);
    return;
  }
  const target = path.resolve(file);
  if (!isWithin(stream.root, target)) {
    // The stream reported a path it cannot place, so its observations may be
    // incomplete. The unplugin broker treats the same case as a gap.
    deliverGap(stream);
    return;
  }
  const event =
    (flags & MODIFIED) !== 0 && (flags & RENAMED) === 0 ? "change" : "rename";
  const deliveries: Array<{ name: string; watch: Watch }> = [];
  let directory = path.dirname(target);
  let depth = 0;
  while (isWithin(stream.root, directory)) {
    const watches = stream.watches.get(directory);
    if (watches !== undefined) {
      const name = path.relative(directory, target);
      for (const watch of watches) {
        if (depth === 0 || watch.recursive) {
          deliveries.push({ name, watch });
        }
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
    depth += 1;
  }
  for (const { name, watch } of deliveries) {
    if (watch.active && watch.stream === stream) watch.listener(event, name);
  }
}

function deliverGap(stream: Stream): void {
  const watches = [...stream.watches.values()].flatMap((set) => [...set]);
  for (const watch of watches) {
    if (watch.active && watch.stream === stream) {
      watch.listener("rename", null, true);
    }
  }
}

function* strictAncestors(location: string): Iterable<string> {
  let ancestor = path.dirname(location);
  while (ancestor !== location) {
    yield ancestor;
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}
