import fs from "node:fs";
import path from "node:path";

import { subscribeLinuxDirectoryWatch } from "./subscribeLinuxDirectoryWatch";

/**
 * Observe `root` recursively on a platform without native recursive
 * notification, by watching only the directories `admit` accepts
 * (samchon/ttsc#1389).
 *
 * Node's `fs.watch(root, { recursive: true })` on Linux walks the whole tree
 * synchronously and opens one inotify watch per file and directory, so a
 * project root with a large `node_modules` blocked every capture and could
 * exhaust the per-user watch limit. This observer opens one non-recursive watch
 * per admitted directory, shared process-wide, and never one per file. A
 * directory created inside a watched one is watched as soon as its creation is
 * reported, when `admit` accepts it, and every entry already inside it is
 * reported as created, since it may have appeared before its watch opened. A
 * directory that disappears releases its watches.
 *
 * Events reach `listener` as a recursive watch reports them: the event type and
 * the changed path relative to `root`, or `null` when the backend could not
 * name the entry, which may then be anything below the root. A root that cannot
 * be watched throws, exactly as `fs.watch` does. Any other watch that cannot be
 * opened or that fails while its directory still exists, the per-user limit
 * among the causes, reaches `onError`, since the observer can no longer claim
 * to cover what it was asked to.
 *
 * @returns The handle, with `track` to watch the directories leading to a path
 *   registered after the observer opened, whatever `admit` says of them.
 */
export function openLinuxDirectoryObserver(
  root: string,
  admit: (directory: string) => boolean,
  listener: (eventType: string, filename: string | null) => void,
  onError: () => void,
): { close(): void; track(file: string): void } {
  const base = path.resolve(root);
  const watched = new Map<string, { close(): void }>();
  let closed = false;
  let failed = false;
  const fail = (): void => {
    if (closed || failed) return;
    failed = true;
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
  const watch = (directory: string, forced = false, announce = false): void => {
    if (closed || failed || watched.has(directory)) return;
    if (!forced && directory !== base && !admit(directory)) return;
    let subscription: { close(): void };
    try {
      subscription = subscribeLinuxDirectoryWatch(
        directory,
        (eventType, filename) => deliver(directory, eventType, filename),
        () => {
          // A directory that is gone ends its own watch; one still present
          // leaves a hole in the coverage.
          if (directory !== base && !fs.existsSync(directory)) {
            release(directory);
          } else {
            fail();
          }
        },
      );
    } catch (error) {
      if (directory === base) throw error;
      fail();
      return;
    }
    watched.set(directory, subscription);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = path.join(directory, entry.name);
      if (announce && !closed) listener("rename", path.relative(base, child));
      if (entry.isDirectory()) watch(child, false, announce);
    }
  };
  const deliver = (
    directory: string,
    eventType: string,
    filename: string | null,
  ): void => {
    if (closed) return;
    if (filename === null) {
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
      } catch {
        release(changed);
      }
      listener(eventType, path.relative(base, changed));
      if (directoryNow) watch(changed, false, true);
      return;
    }
    listener(eventType, path.relative(base, changed));
  };
  watch(base);
  return {
    close: () => {
      closed = true;
      for (const subscription of watched.values()) subscription.close();
      watched.clear();
    },
    track: (file) => {
      const relative = path.relative(base, path.resolve(file));
      if (relative.startsWith("..") || path.isAbsolute(relative)) return;
      let directory = base;
      for (const segment of relative.split(path.sep).slice(0, -1)) {
        directory = path.join(directory, segment);
        // Only a directory is ever watched, never a file on the way.
        if (
          fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory() !==
          true
        )
          return;
        watch(directory, true);
        if (!watched.has(directory)) return;
      }
    },
  };
}
