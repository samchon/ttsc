import fs from "node:fs";
import path from "node:path";

import { pathIsWithin } from "../../filesystem/pathIsWithin";
import { subscribeLinuxDirectoryWatch } from "./subscribeLinuxDirectoryWatch";

/**
 * Observe `root` recursively through Linux helper directory watches, applying
 * caller admission before acquiring descendant coverage (samchon/ttsc#1389).
 *
 * This observer opens one non-recursive subscription per admitted directory,
 * shared through the loaded helper directory registry, and never one per file.
 * Root and paths forced by `track` can be watched despite admission. A
 * directory created inside a watched one is watched as soon as its creation is
 * reported, when `admit` accepts it, and every entry already inside it is
 * reported as created, since it may have appeared before its watch opened. A
 * directory confirmed absent releases its subtree watches; unavailable topology
 * or enumeration instead withdraws coverage through `onError`.
 *
 * The watches live in the Linux watch helper (samchon/ttsc#1426), which answers
 * each one asynchronously. A directory is read only once its watch is live, so
 * the opening interval can be covered by enumeration or delivered events.
 * Successful initial readiness requires admitted directories to be watched and
 * enumerated. This is not an atomic tree snapshot; native loss still arrives as
 * a conservative unnamed event. Failure resolves false, and later failure does
 * not change an already resolved readiness Promise.
 *
 * Events reach `listener` as a recursive watch reports them: the event type and
 * the changed path relative to `root`, or `null` when the backend could not
 * name the entry, which may then be anything below the root. The helper reports
 * dropped events that way to every watch at once, and the observer passes them
 * on as one. A root that cannot be watched throws, exactly as `fs.watch` does,
 * or resolves `ready` to `false`. Any other watch that cannot be opened or that
 * fails while its directory still exists, the per-user limit among the causes,
 * reaches `onError`, since the observer can no longer claim to cover what it
 * was asked to.
 *
 * @returns The handle, with `track` to watch the directories leading to a path
 *   registered after the observer opened, and the path itself while it is a
 *   directory, whatever `admit` says of them. A directory it newly watches
 *   follows `admit` below itself, as every watched directory does, but one
 *   already watched is not read again. With `subtree`, `track` reads the
 *   directories below that path again and watches every one `admit` now
 *   accepts, for a registration that widened what `admit` accepts there
 *   (samchon/ttsc#1419). Once every watch a `track` opened is live, the path is
 *   reported changed when that pending batch completes, since it may have
 *   changed before they were. A track with no pending opening emits no such
 *   batch callback. `prune` releases non-root directories that current
 *   admission no longer needs; call it after an atomic registration update,
 *   once per observer.
 * @evidence contracts/common.md#principled-implementation
 *   Watches go live before enumeration; newly admitted directories announce
 *   existing entries; failed enumeration or unknown topology withdraws coverage
 *   instead of certifying an empty or deleted subtree.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One directory map owns recursive coverage; loaded-registry non-recursive
 *   subscriptions own native handles and track batches own widened admission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Admission follows caller responsibility, not a hardcoded tree blacklist;
 *   lost names remain a conservative root-wide event and watch failures withdraw coverage.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and return comments distinguish initial coverage, dynamic
 *   discovery, failure and widened track scope under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral recursive semantics use node:path and directory metadata; native
 *   non-recursive helper watches avoid assuming every platform supports fs recursion.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Enumeration visits E entries across D admitted/forced directories and
 *   delegates native watch/read/path work. Retirement copies/scans the D-watch
 *   map and compares path text; prune scans D entries, while track examines
 *   path-component prefixes and widening rescans selected directory listings.
 *   Named events add native metadata and listener work. Unnamed bursts share
 *   one notification until the queued microtask clears the coalescing flag.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The observer reuses live directory entries and joins opening readiness;
 *   shared native subscriptions avoid reopening equivalent directory watches.
 *   Explicit subtree widening revisits only existing coverage that may admit more.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The caller owns D directory subscriptions and outstanding readiness/batch
 *   references; confirmed absence and prune retire entries, while failure keeps
 *   remaining handles until close. Closure attempts each handle and prevents
 *   later reads from adding coverage. No count/byte or initial-readiness deadline
 *   is supplied. Listener/admission/error callbacks must return normally for
 *   batch settlement and cleanup to finish; arbitrary callback exceptions are
 *   not isolated, and local retirement is not certified native completion.
 *   Track prefix stat failures can also propagate to the caller.
 */
export function openLinuxDirectoryObserver(
  root: string,
  admit: (directory: string) => boolean,
  listener: (eventType: string, filename: string | null) => void,
  onError: () => void,
): {
  close(): void;
  ready: Promise<boolean>;
  track(file: string, subtree?: boolean): void;
  prune(): void;
} {
  const base = path.resolve(root);
  const watched = new Map<
    string,
    { close(): void; live: boolean; ready: Promise<boolean> }
  >();
  let closed = false;
  let failed = false;
  let settle!: (live: boolean) => void;
  const ready = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  const fail = (): void => {
    if (closed || failed) return;
    failed = true;
    settle(false);
    onError();
  };
  const release = (directory: string): void => {
    for (const [watchedDirectory, subscription] of [...watched]) {
      if (
        watchedDirectory === directory ||
        watchedDirectory.startsWith(`${directory}${path.sep}`)
      ) {
        subscription.close();
        watched.delete(watchedDirectory);
      }
    }
  };
  // A group of watches whose liveness one caller waits for: the initial tree,
  // or the directories one `track` opened, with those their reads open below.
  interface Batch {
    pending: number;
    settle(): void;
  }
  const join = (batch: Batch | undefined, live: Promise<unknown>): void => {
    if (batch === undefined) return;
    batch.pending += 1;
    void live.then(() => {
      batch.pending -= 1;
      if (batch.pending === 0) batch.settle();
    });
  };
  const watch = (
    directory: string,
    forced = false,
    announce = false,
    batch?: Batch,
  ): void => {
    if (closed || failed) return;
    const existing = watched.get(directory);
    if (existing !== undefined) {
      // Still being opened for another caller: this one waits for it too.
      if (!existing.live) join(batch, existing.ready);
      return;
    }
    if (!forced && directory !== base && !admit(directory)) return;
    let subscription: { close(): void; ready: Promise<boolean> };
    try {
      subscription = subscribeLinuxDirectoryWatch(
        directory,
        (eventType, filename) => deliver(directory, eventType, filename),
        () => {
          // Only confirmed absence retires descendant coverage. A failed
          // presence observation does not prove that those directories vanished.
          if (directory !== base) {
            try {
              fs.lstatSync(directory);
            } catch (error) {
              const code = (error as NodeJS.ErrnoException | undefined)?.code;
              if (code === "ENOENT" || code === "ENOTDIR") {
                release(directory);
                return;
              }
            }
          }
          fail();
        },
      );
    } catch (error) {
      if (directory === base) throw error;
      fail();
      return;
    }
    const entry = {
      close: subscription.close,
      live: false,
      ready: subscription.ready,
    };
    watched.set(directory, entry);
    // Read the directory only once its watch is live, so an entry created in
    // between is either read here or heard.
    const read = subscription.ready.then((live) => {
      entry.live = true;
      if (!live || closed || failed || watched.get(directory) !== entry) {
        return;
      }
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch {
        fail();
        return;
      }
      for (const child of entries) {
        const childPath = path.join(directory, child.name);
        if (announce && !closed) {
          listener("rename", path.relative(base, childPath));
        }
        if (child.isDirectory()) watch(childPath, false, announce, batch);
      }
    });
    join(batch, read);
  };
  // Watch the admitted directories below a watched one that the observer
  // passed over when `admit` still declined them.
  const scan = (directory: string, batch: Batch): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      fail();
      return;
    }
    for (const entry of entries) {
      if (closed || failed) return;
      if (!entry.isDirectory()) continue;
      const child = path.join(directory, entry.name);
      if (watched.has(child)) scan(child, batch);
      else watch(child, false, false, batch);
    }
  };
  // The helper reports dropped events to every watch at once; the observer
  // passes the notice on once per burst.
  let unattributed = false;
  const deliver = (
    directory: string,
    eventType: string,
    filename: string | null,
  ): void => {
    if (closed) return;
    if (filename === null) {
      if (unattributed) return;
      unattributed = true;
      queueMicrotask(() => {
        unattributed = false;
      });
      listener(eventType, null);
      return;
    }
    const changed = path.join(directory, filename);
    // A recursive watch starts reporting inside a new directory at once; this
    // one does from the moment the directory is admitted.
    if (eventType === "rename") {
      let directoryNow = false;
      try {
        const stats = fs.lstatSync(changed);
        directoryNow = stats.isDirectory();
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT" || code === "ENOTDIR") release(changed);
        else fail();
      }
      listener(eventType, path.relative(base, changed));
      if (directoryNow) watch(changed, false, true);
      return;
    }
    listener(eventType, path.relative(base, changed));
  };
  watch(base, false, false, {
    pending: 0,
    settle: () => {
      if (!closed && !failed) settle(true);
    },
  });
  return {
    close: () => {
      closed = true;
      settle(false);
      for (const subscription of watched.values()) subscription.close();
      watched.clear();
    },
    ready,
    prune: () => {
      if (closed || failed) return;
      for (const [directory, subscription] of watched) {
        if (directory === base || admit(directory)) continue;
        subscription.close();
        watched.delete(directory);
      }
    },
    track: (file, subtree = false) => {
      const absolute = path.resolve(file);
      if (!pathIsWithin(absolute, base)) return;
      // Once every watch this call opened is live, the path may have changed
      // before any of them could hear it.
      const batch: Batch = {
        pending: 0,
        settle: () => {
          if (!closed && !failed) {
            listener("change", path.relative(base, absolute));
          }
        },
      };
      const relative = path.relative(base, absolute);
      let directory = base;
      for (const segment of relative === "" ? [] : relative.split(path.sep)) {
        directory = path.join(directory, segment);
        // Only a directory is ever watched, never a file on the way.
        if (
          fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory() !==
          true
        )
          break;
        watch(directory, true, false, batch);
        if (!watched.has(directory)) break;
      }
      if (subtree && watched.has(directory)) scan(directory, batch);
    },
  };
}
