/**
 * Reconcile the live watchers with the desired set, transactionally.
 *
 * Missing watchers are created first. Only when every desired watcher exists
 * are the ones no longer desired closed, so a failed or interrupted creation
 * never leaves an input unobserved. A watcher that later errors removes itself
 * and reports through `onError`.
 *
 * `onChange` hears every watcher this opened or closed, including one an error
 * closed later, with its location, or `undefined` for one closed because it is
 * no longer desired: a backend may serve several watches through one stream
 * that opening or closing any of them re-creates (`settleWatchBackend`).
 *
 * @returns `false` when a creation failed or `shouldContinue` stopped the pass.
 */
export function syncWatchers<T extends SynchronizedWatcher>(
  watchers: Map<string, T>,
  desired: ReadonlyMap<string, string>,
  create: (location: string, key: string) => T,
  onError: (location: string, error: unknown) => void,
  shouldContinue: () => boolean = () => true,
  onChange: (location: string | undefined) => void = () => undefined,
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
        onChange(location);
        onError(location, error);
      });
      watchers.set(key, watcher);
      onChange(location);
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
    onChange(undefined);
  }
  return true;
}

type SynchronizedWatcher = {
  close(): void;
  on(event: "error", listener: (error: Error) => void): unknown;
};
