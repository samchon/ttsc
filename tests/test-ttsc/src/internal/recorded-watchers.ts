import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { watchDirectoryThroughFsWatch } from "../../../../packages/ttsc/lib/launcher/internal/watch/watchDirectoryThroughFsWatch.js";

/** A listener `fs.watch` was handed. */
export type RecordedWatchListener = (
  event: string,
  filename: string | null,
) => void;

/** One `fs.watch` registration, recorded instead of watching. */
export interface IRecordedWatcher {
  active: boolean;
  close(): void;
  listener: RecordedWatchListener;
  location: string;
  on(): IRecordedWatcher;
  recursive: boolean;
}

/**
 * Own a pair of observer operations that record subscriptions and callbacks.
 *
 * The real directory adapter normalizes events using the supplied file
 * subscription operation; neither operation replaces a global fs method.
 * WatchTopology receives both operations explicitly and owns closing handles.
 */
export function recordWatchers(): {
  openDirectoryWatch: typeof watchDirectoryThroughFsWatch;
  openFileWatch: typeof fs.watch;
  watchers: IRecordedWatcher[];
} {
  const watchers: IRecordedWatcher[] = [];
  const openFileWatch = ((location: fs.PathLike, ...rest: unknown[]) => {
      const listener = rest.find(
        (value): value is RecordedWatchListener => typeof value === "function",
      );
      const options = rest.find(
        (value): value is { recursive?: boolean } =>
          typeof value === "object" && value !== null,
      );
      const watcher: IRecordedWatcher = {
        active: true,
        close: () => {
          watcher.active = false;
        },
        listener: (event, filename) => {
          if (watcher.active) listener?.(event, filename);
        },
        location: path.resolve(String(location)),
        on: () => watcher,
        recursive: options?.recursive === true,
      };
      watchers.push(watcher);
      return watcher as unknown as fs.FSWatcher;
    }) as typeof fs.watch;
  const openDirectoryWatch: typeof watchDirectoryThroughFsWatch = (...args) =>
    watchDirectoryThroughFsWatch(args[0], args[1], args[2], openFileWatch);
  return { openDirectoryWatch, openFileWatch, watchers };
}

/**
 * Deliver an event for `entry` to every recorded watcher that observes it,
 * named as each backend names it: a watcher of the entry itself and a watcher
 * of its parent directory by its base name, and a recursive watcher of an
 * ancestor by its path below that ancestor.
 */
export function deliverWatchEvent(
  watchers: readonly IRecordedWatcher[],
  entry: string,
  event: string,
): void {
  let delivered = 0;
  for (const watcher of watchers) {
    if (!watcher.active) continue;
    const relative = path.relative(watcher.location, entry);
    const observed =
      relative === "" ||
      relative === path.basename(entry) ||
      (watcher.recursive &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative));
    if (!observed) continue;
    watcher.listener(event, relative === "" ? path.basename(entry) : relative);
    delivered += 1;
  }
  assert.ok(delivered !== 0, `no registered watcher observes ${entry}`);
}

/** Let queued microtasks and timers run once. */
export async function settleWatchEvents(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}
