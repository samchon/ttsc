/**
 * Detach and close every watcher, then throw the first cleanup failure.
 *
 * Detaching before callbacks makes ownership end even when a closer fails or
 * reenters cleanup. Every original handle receives its close attempt.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The detached snapshot defines the handles owned by this close operation;
 *   a separate failure flag preserves even a thrown undefined value.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One pass collects the first failure while attempting every close. The
 *   caller's original array no longer exposes already-retiring handles.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Cleanup does not swallow the first error or stop at it; supported close
 *   callbacks receive one attempt without replacing their implementation.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs state error ordering and the reentrancy reason for
 *   detachment, following the documentation skill.
 * @evidence contracts/performance.md#efficient-algorithms
 *   For n handles the snapshot and close pass require O(n) work and O(n)
 *   temporary references; no pairwise lookup or repeated removal is used.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Closing owned handles is an ownership-ending effect, not a computation
 *   whose result another owner may reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The array transfers all current handles into this operation and becomes
 *   empty before callbacks. Every detached handle is attempted on failure as
 *   well as success; a throwing closer may still fail to release its resource.
 */
export function closeDirectoryWatches(watchers: { close: () => void }[]): void {
  const owned = watchers.splice(0);
  let failed = false;
  let failure: unknown;
  for (const watcher of owned) {
    try {
      watcher.close();
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  if (failed) throw failure;
}
