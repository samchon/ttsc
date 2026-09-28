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
  close(): void;
  listener: RecordedWatchListener;
  location: string;
  on(): IRecordedWatcher;
  recursive: boolean;
}

/**
 * Replace `fs.watch` with watchers that record their location, options, and
 * listener instead of watching, so a case decides which events arrive and in
 * what order.
 *
 * A directory watch goes through `fs.watch` only on the backend that uses it,
 * so a case hands `openDirectoryWatch` to the `WatchTopology` it builds, and
 * every directory watch is recorded on every platform.
 *
 * @returns The watchers registered from now on, the directory-watch backend
 *   that records them, and the function that puts the real `fs.watch` back.
 */
export function recordWatchers(): {
  openDirectoryWatch: typeof watchDirectoryThroughFsWatch;
  restore(): void;
  watchers: IRecordedWatcher[];
} {
  const watchers: IRecordedWatcher[] = [];
  const originalWatch = fs.watch;
  Object.defineProperty(fs, "watch", {
    configurable: true,
    value: ((location: fs.PathLike, ...rest: unknown[]) => {
      const listener = rest.find(
        (value): value is RecordedWatchListener => typeof value === "function",
      );
      const options = rest.find(
        (value): value is { recursive?: boolean } =>
          typeof value === "object" && value !== null,
      );
      const watcher: IRecordedWatcher = {
        close: () => undefined,
        listener: listener ?? (() => undefined),
        location: path.resolve(String(location)),
        on: () => watcher,
        recursive: options?.recursive === true,
      };
      watchers.push(watcher);
      return watcher as unknown as fs.FSWatcher;
    }) as typeof fs.watch,
    writable: true,
  });
  return {
    openDirectoryWatch: watchDirectoryThroughFsWatch,
    restore: () =>
      Object.defineProperty(fs, "watch", {
        configurable: true,
        value: originalWatch,
        writable: true,
      }),
    watchers,
  };
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
