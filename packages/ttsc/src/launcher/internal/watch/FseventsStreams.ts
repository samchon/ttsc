import { EventEmitter } from "node:events";
import path from "node:path";

import type { DirectoryWatcher } from "./DirectoryWatcher";

/**
 * The FSEventStreams serving this process's macOS directory watches.
 *
 * A stream covers its root recursively. Watches below an open stream join it;
 * opening an ancestor starts its stream before retiring the descendant streams.
 * Still-active transferred watches receive a deferred gap notification; their
 * owners decide the content recheck. Retired streams reject later callbacks
 * through their inactive guard. Stream roots and their descendants are indexed,
 * so registration, close, and named event delivery depend on path depth and
 * affected watches rather than every stream in the process.
 *
 * @evidence contracts/common.md#principled-implementation Ancestor streams cover descendant subscriptions; promotion starts replacement observation before retiring old streams and then reports the handoff gap.
 * @evidence contracts/common.md#clear-and-simple-design Stream ownership and descendant indexes are distinct from each watch's listener and close state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The registry uses the binding's supported watch/stop boundary and explicit gaps instead of patching libuv or assuming queued callbacks survive stop.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain ancestor reuse, transfer ordering, gaps and index-driven delivery following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation This macOS binding boundary interprets FSEvents flags explicitly and exposes the same DirectoryWatcher contract as Node's other native backends.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The class representation groups indexes; open and event helpers own processing strategies.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Registration operations establish stream sharing rather than the state representation itself.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Registry methods own active native streams and ancestor/subscription indexes, growing with roots, depth, text and watches without a quota. Last-subscription close removes logical indexes and attempts native stop, whose failures are suppressed. Returned watcher closures/listeners can remain caller-reachable after close; callers must discard retired objects to permit reclamation.
 */
export class FseventsStreams {
  private readonly descendants = new Map<string, Set<Stream>>();
  private readonly streams = new Map<string, Stream>();

  /** Use the binding supplied by the host for every stream in this registry. */
  public constructor(private readonly binding: FseventsBinding) {}

  /**
   * Load the optional binding, or warn and return `null` without it. The
   * selecting watchDirectory owner calls this once for the process.
   *
   * @evidence contracts/common.md#principled-implementation A binding must expose the required watch function before the registry can use it; unavailable optional support is surfaced by a warning.
   * @evidence contracts/common.md#clear-and-simple-design One shape check constructs the registry or returns explicit unavailability.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The real Node watcher fallback serves missing optional production support, not a fake successful binding or fixture branch.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes per-call warning from the selecting owner's once-per-process scheduling following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation The optional macOS binding is loaded at its explicit native boundary and its absence retains supported Node observation with a stated limitation.
   *
   * @evidence contracts/performance.md#efficient-algorithms require delegates module resolution/loading and possible native binding initialization, then a fixed interface check constructs two empty registry maps or formats/emits a warning. Module/path/initialization work is not bounded by the shape check; this method traverses no watch population.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The selecting owner caches availability; calling this constructor directly does not coordinate caller reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned registry owns no stream until open acquires one; module loading has no independently released watcher here.
   */
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
   * @evidence contracts/common.md#principled-implementation A watch joins a covering ancestor stream; promotion transfers existing subscriptions before retiring displaced streams and schedules one gap recheck.
   * @evidence contracts/common.md#clear-and-simple-design Stream selection is separate from subscription state; returned close/on callbacks operate on one captured watch.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Transfer gaps are reported explicitly rather than hidden by repeated registration or assumptions about stopped native callbacks.
   * @evidence contracts/common.md#meaningful-documentation Native parameters explain physical roots, recursion, absent names and idempotent returned ownership following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Physical path.resolve/dirname ancestry qualifies the macOS native stream; callers retain the backend-independent DirectoryWatcher interface.
   * @evidence contracts/performance.md#efficient-algorithms D path ancestors locate a covering stream; indexed descendants visit displaced roots and W subscriptions, with ancestor-index removal/insertion per displaced root and local displaced/transferred collections. Native watch/stop, path/key text, deferred gap listeners and event delivery contribute delegated costs. Named delivery follows ancestry and eligible watches, while gaps visit the affected stream population. Depth/text/watch populations are uncapped.
   * @evidence contracts/performance.md#reuse-equivalent-work Recursive native observation is shared by watches under one live ancestor; promotion preserves each listener/recursion contract while replacing the underlying stream identity.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The registry owns active stream handles and O(SD+W) index/subscription references for S roots and W watches, plus associated path/listener text without a quota. Last-subscription closure unregisters and attempts stop; suppressed stop failures cannot prove native reclamation. Retired returned watcher objects still capture their watch/registry/listeners until callers discard them.
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
        // Retired streams reject later callbacks through their inactive guard.
        // The new stream receives later events; a gap notice lets the owner
        // recheck the handoff.
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
