import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Directory adapters supplied by either the source or built test population. */
export type RecordedDirectoryAdapter = (
  location: string,
  recursive: boolean,
  listener: (
    event: "change" | "rename",
    filename: string | null,
    gap?: boolean,
  ) => void,
  openWatch?: typeof fs.watch,
) => {
  close(): void;
  on(event: "error", listener: (error: Error) => void): unknown;
};

/** An explicitly delivered observer notification, including a missing name. */
export type RecordedWatchListener = (
  event: string,
  filename: string | null,
) => void;

/** A subscription whose owner can close it before later notifications. */
export interface IRecordedWatcher {
  active: boolean;
  close(): void;
  listener: RecordedWatchListener;
  location: string;
  on(): IRecordedWatcher;
  recursive: boolean;
}

/**
 * Record subscriptions through the caller's actual directory event adapter.
 *
 * Source units supply the source adapter; built boundary cases supply its built
 * counterpart. The operation stores callbacks and handle lifetimes without
 * registering an OS subscription or changing any global filesystem method.
 *
 * @evidence contracts/common.md#principled-implementation Records native-compatible subscription arguments and delivers callbacks only while their handle remains active; the supplied actual adapter owns directory event normalization.
 * @evidence contracts/common.md#clear-and-simple-design One recorder supplies file and directory operations and their shared registration array to both test populations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied operations replace an explicit dependency without modifying fs.watch or inventing topology results.
 * @evidence contracts/common.md#meaningful-documentation States source versus built adapter selection and that recorded registrations are not actual OS subscriptions.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution preserves location spelling; recursion comes from the actual subscription options.
 * @evidence contracts/performance.md#efficient-algorithms One registration appends one constant-size handle record; callback delivery performs no directory traversal.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each registration has its own callback and handle, with no retained computation reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The test owns the returned array; topology close marks every acquired handle inactive and subsequent delivery respects that state.
 */
export function recordWatchers(adapter: RecordedDirectoryAdapter): {
  openDirectoryWatch: RecordedDirectoryAdapter;
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
  const openDirectoryWatch: RecordedDirectoryAdapter = (
    location,
    recursive,
    listener,
  ) => adapter(location, recursive, listener, openFileWatch);
  return { openDirectoryWatch, openFileWatch, watchers };
}

/** Deliver the authored path to every active subscription covering that path. */
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

/** Yield to queued microtasks and observer timers once. */
export async function settleWatchEvents(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}
