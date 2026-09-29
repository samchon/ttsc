/**
 * Reconcile the live watchers with the desired set, transactionally.
 *
 * Missing watchers are created first. Only when every desired watcher exists
 * are the ones no longer desired closed, so a failed or interrupted creation
 * never leaves an input unobserved. A watcher that later errors removes itself
 * and reports through `onError`.
 *
 * @returns `false` when a creation failed or `shouldContinue` stopped the pass.
 *
 * @evidence contracts/common.md#principled-implementation New coverage is admitted before obsolete watchers are retired, so a failed creation leaves the previously live observation set intact.
 * @evidence contracts/common.md#clear-and-simple-design Creation and retirement are two explicit passes; one captured watcher identity qualifies later error removal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed creation is reported instead of replacing the missing watcher with a fake success or discarding old coverage.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain transaction order, late failure and interruption following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native watcher construction is injected through one supported boundary while the shared reconciler preserves its error and close semantics.
 * @evidence contracts/performance.md#efficient-algorithms One desired-map pass and one live-map pass reconcile D desired and L live watchers in O(D+L) indexed membership checks.
 * @evidence contracts/performance.md#reuse-equivalent-work A still-live watcher under the same desired key is reused; changed desired membership creates replacement coverage before retiring old keys.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the live map; obsolete and failed watchers close, while partial creation retains old coverage until a successful reconciliation or owner shutdown.
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
    let watcher: T | undefined;
    try {
      watcher = create(location, key);
      const registered = watcher;
      watcher.on("error", (error) => {
        if (watchers.get(key) === registered) {
          watchers.delete(key);
        }
        registered.close();
        onError(location, error);
      });
      watchers.set(key, watcher);
    } catch (error) {
      watcher?.close();
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
