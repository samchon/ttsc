/**
 * Reconcile the live watchers with the desired set, transactionally.
 *
 * Missing watchers are created first. Only when every desired watcher exists
 * are the ones no longer desired closed, so a failed or interrupted creation
 * retains the previously live watcher map. This ordering alone does not prove
 * native coverage during backend failure. A watcher that later errors removes
 * itself and reports through `onError`.
 *
 * @returns `false` when a creation failed or `shouldContinue` stopped the pass.
 * @evidence contracts/common.md#principled-implementation New coverage is admitted before obsolete watchers are retired, so a failed creation leaves the previously live observation set intact.
 * @evidence contracts/common.md#clear-and-simple-design Creation and retirement are two explicit passes; one captured watcher identity qualifies later error removal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed creation is reported instead of replacing the missing watcher with a fake success or discarding old coverage.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain transaction order, late failure and interruption following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native watcher construction is injected through one supported boundary while the shared reconciler preserves its error and close semantics.
 * @evidence contracts/performance.md#efficient-algorithms One desired-map pass and, if complete, one live-map pass inspect D desired and L live entries. Indexed key text, shouldContinue, create, error subscription and close callbacks contribute their own costs, including delegated native observation/lifecycle work. Partial creation stops retirement; D/L and key text are uncapped here.
 * @evidence contracts/performance.md#reuse-equivalent-work A still-live watcher under the same desired key is reused; changed desired membership creates replacement coverage before retiring old keys.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the live map and handles. Obsolete and failed watchers receive close attempts, while partial creation retains old entries until later reconciliation or shutdown. Backend close/callback failures can propagate; map ownership does not certify native release or uninterrupted event coverage.
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
