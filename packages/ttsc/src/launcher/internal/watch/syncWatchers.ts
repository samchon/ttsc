/**
 * Reconcile the live watchers with the desired set, transactionally.
 *
 * Missing watchers are created first. Only when every desired watcher exists
 * are the ones no longer desired closed, so a failed or interrupted creation
 * never leaves an input unobserved. A watcher that later errors removes itself
 * and reports through `onError`.
 *
 * @returns `false` when a creation failed or `shouldContinue` stopped the pass.
 */
export function syncWatchers<T extends SynchronizedWatcher>(
  watchers: Map<string, T>,
  desired: ReadonlyMap<string, string>,
  create: (location: string, key: string) => T,
  onError: (location: string, error: unknown) => void,
  shouldContinue: () => boolean = () => true,
): boolean {
  let complete = true;
  for (const [key, location] of desired) {
    if (!shouldContinue()) {
      complete = false;
      break;
    }
    if (watchers.has(key)) continue;
    try {
      const watcher = create(location, key);
      watcher.on("error", (error) => {
        if (watchers.get(key) === watcher) {
          watchers.delete(key);
        }
        watcher.close();
        onError(location, error);
      });
      watchers.set(key, watcher);
    } catch (error) {
      complete = false;
      onError(location, error);
    }
  }
  if (!complete) return false;
  for (const [key, watcher] of watchers) {
    if (desired.has(key)) continue;
    watcher.close();
    watchers.delete(key);
  }
  return true;
}

type SynchronizedWatcher = {
  close(): void;
  on(event: "error", listener: (error: Error) => void): unknown;
};
