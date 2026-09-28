import { EventEmitter } from "node:events";
import path from "node:path";

import type { DirectoryWatcher } from "./DirectoryWatcher";
import { watchDirectoryThroughFsWatch } from "./watchDirectoryThroughFsWatch";

/**
 * Watch a directory's entries, or everything below it when `recursive`.
 *
 * `listener` hears `change` for an entry whose content moved and `rename` for
 * every other event, with the entry's path relative to `location`, as
 * `fs.watch` names it. A `null` name says anything below `location` may have
 * changed and must be read again.
 *
 * On macOS, libuv serves every directory `fs.watch` of a process through one
 * FSEventStream. It re-creates that stream whenever any watch opens or closes,
 * and the new stream reports nothing from the gap (samchon/ttsc#1583). It also
 * discards every event that carries a dropped-events flag, so an overflow goes
 * unreported (samchon/ttsc#1590). Where the `fsevents` binding loads, the
 * watches go through it instead, as `@ttsc/unplugin`'s watch broker does for
 * the same two faults (samchon/ttsc#1418, samchon/ttsc#1425):
 * - FSEvents streams are recursive, so one stream serves every watch at or
 *   below its root. A watch below an open stream joins it, and a watch above
 *   open streams opens its own and takes theirs over. Opening or closing a
 *   watch therefore stops no stream another watch still depends on.
 * - A stream that reports dropped events, a wrapped event id, a changed root,
 *   or a mount or unmount delivers a `null` name to each of its watches.
 *
 * Without the binding, a macOS watch falls back to `fs.watch`, with one warning
 * that such losses cannot be observed. Every other platform uses `fs.watch`.
 *
 * @param location The directory, spelled as the filesystem names it.
 * @param recursive Whether entries below subdirectories are heard.
 * @param listener Receives each event.
 * @returns The open watch.
 */
export function watchDirectory(
  location: string,
  recursive: boolean,
  listener: (event: "change" | "rename", filename: string | null) => void,
): DirectoryWatcher {
  const streams = fseventsStreams();
  if (streams !== undefined) return streams.open(location, recursive, listener);
  return watchDirectoryThroughFsWatch(location, recursive, listener);
}

/**
 * The fsevents flags (CoreServices' `kFSEventStreamEventFlag*`). A stream that
 * reports any of `GAP` may have lost events: must-scan-subdirectories,
 * user-dropped, kernel-dropped, event-ids-wrapped, root-changed, mount, and
 * unmount. libuv reports `change` for an event that modified an item without
 * creating, removing, or renaming one, and `rename` for every other.
 */
const GAP = 0x1 | 0x2 | 0x4 | 0x8 | 0x20 | 0x40 | 0x80;
const MODIFIED = 0x400 | 0x1000 | 0x2000 | 0x4000 | 0x8000;
const RENAMED = 0x100 | 0x200 | 0x800;

/** The part of the `fsevents` binding this module uses. */
type FseventsBinding = {
  watch(
    root: string,
    handler: (file: string, flags: number) => void,
  ): () => unknown;
};

type Watch = {
  directory: string;
  emitter: EventEmitter;
  listener: (event: "change" | "rename", filename: string | null) => void;
  recursive: boolean;
};

type Stream = {
  root: string;
  stop: () => unknown;
  /** The watches this stream serves, by the directory each watches. */
  watches: Map<string, Set<Watch>>;
};

let registry: FseventsStreams | null | undefined;

/** The shared streams, or `undefined` where watches go through `fs.watch`. */
function fseventsStreams(): FseventsStreams | undefined {
  if (registry === undefined) {
    registry =
      process.platform === "darwin" ? FseventsStreams.load() : null;
  }
  return registry ?? undefined;
}

/**
 * Every FSEventStream this process holds for directory watches, one per root
 * that no other watched directory contains.
 */
class FseventsStreams {
  private readonly streams = new Map<string, Stream>();

  private constructor(private readonly binding: FseventsBinding) {}

  /** Load the binding, or warn once and return `null` without it. */
  public static load(): FseventsStreams | null {
    try {
      return new FseventsStreams(require("fsevents") as FseventsBinding);
    } catch {
      process.emitWarning(
        "the optional `fsevents` package could not be loaded, so `ttsc --watch` watches through `fs.watch`, which on macOS can lose events without notice. Reinstall ttsc without omitting optional dependencies.",
        { code: "TTSC_WATCH_FSEVENTS_UNAVAILABLE" },
      );
      return null;
    }
  }

  public open(
    location: string,
    recursive: boolean,
    listener: Watch["listener"],
  ): DirectoryWatcher {
    const watch: Watch = {
      directory: path.resolve(location),
      emitter: new EventEmitter(),
      listener,
      recursive,
    };
    const stream = this.streamFor(watch.directory);
    addWatch(stream, watch);
    let open = true;
    const close = (): void => {
      if (!open) return;
      open = false;
      this.close(watch);
    };
    return {
      close,
      on: (event, handler) => watch.emitter.on(event, handler),
    };
  }

  /**
   * The stream that serves `directory`: an open stream at or above it, or a
   * new one at it that takes over every stream below it. The new stream starts
   * before the ones it replaces stop, so no event between them is lost; one
   * heard by both reaches its watch twice, which a watch decides from what it
   * reads, not from how often it heard.
   */
  private streamFor(directory: string): Stream {
    for (const stream of this.streams.values()) {
      if (isWithin(stream.root, directory)) return stream;
    }
    const stream: Stream = {
      root: directory,
      stop: () => undefined,
      watches: new Map(),
    };
    stream.stop = this.binding.watch(directory, (file, flags) =>
      deliver(stream, file, flags),
    );
    for (const [root, replaced] of [...this.streams]) {
      if (!isWithin(directory, root)) continue;
      for (const watches of replaced.watches.values()) {
        for (const watch of watches) addWatch(stream, watch);
      }
      this.streams.delete(root);
      stopStream(replaced);
    }
    this.streams.set(directory, stream);
    return stream;
  }

  private close(watch: Watch): void {
    for (const [root, stream] of this.streams) {
      const watches = stream.watches.get(watch.directory);
      if (watches?.delete(watch) !== true) continue;
      if (watches.size === 0) stream.watches.delete(watch.directory);
      if (stream.watches.size === 0) {
        this.streams.delete(root);
        stopStream(stream);
      }
      return;
    }
  }
}

function addWatch(stream: Stream, watch: Watch): void {
  const watches = stream.watches.get(watch.directory) ?? new Set<Watch>();
  watches.add(watch);
  stream.watches.set(watch.directory, watches);
}

function stopStream(stream: Stream): void {
  Promise.resolve(stream.stop()).catch(() => undefined);
}

/**
 * Hand one FSEvents event to the watches it concerns: a watch of the event's
 * parent directory by the entry's name, and a recursive watch of any ancestor
 * by the path below it. An event about a watched directory itself says
 * nothing about its entries, as with libuv. A gap reaches every watch of the
 * stream unnamed.
 */
function deliver(stream: Stream, file: string, flags: number): void {
  if ((flags & GAP) !== 0) {
    for (const watches of stream.watches.values()) {
      for (const watch of [...watches]) watch.listener("rename", null);
    }
    return;
  }
  const event = (flags & MODIFIED) !== 0 && (flags & RENAMED) === 0
    ? "change"
    : "rename";
  const target = path.resolve(file);
  let directory = path.dirname(target);
  let depth = 0;
  while (isWithin(stream.root, directory)) {
    const watches = stream.watches.get(directory);
    if (watches !== undefined) {
      const name = path.relative(directory, target);
      for (const watch of [...watches]) {
        if (depth === 0 || watch.recursive) watch.listener(event, name);
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
    depth += 1;
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
