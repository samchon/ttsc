/**
 * Run the work a held build lock protects, then release the lock without
 * letting the release replace the work's outcome.
 *
 * A release that throws from a `finally` block replaced whatever the work
 * produced: a build that had published its binary failed, and a build that had
 * failed reported the release's error instead of its own (samchon/ttsc#1510).
 * The work's value is returned and its error is thrown as they were. A release
 * that still fails goes to `onReleaseFailure`, and the generation it left held
 * is reclaimed as abandoned once its owner exits, as any holder's is.
 *
 * @param work Synchronous work under the lock. Returning a Promise does not
 *   extend lock ownership until that Promise settles.
 * @param release Frees the lock.
 * @param onReleaseFailure Receives a release's error, which it must not throw.
 *
 * @returns What `work` returned.
 *
 * @throws What `work` threw.
 *
 * @evidence contracts/common.md#principled-implementation Both synchronous success and failure release the lock before preserving the original outcome; the release reporter must not throw, and asynchronous work is outside this lock-lifetime contract.
 * @evidence contracts/common.md#clear-and-simple-design One outcome branch and a shared release-reporting helper expose the ownership transition without wrapping successful results in another protocol.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Real release failures are reported rather than converted into a fabricated build failure or success; no foreign release method is replaced.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain outcome preservation and abandoned-generation recovery; parameter prose makes synchronous ownership and the nonthrowing reporter premise explicit.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This adapter sequences one opaque synchronous work callback and one release; the computation strategy belongs to their owners.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Executing held work and releasing a lock are effectful ownership transitions and cannot be shared by matching callback identities.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller transfers a held lock for the synchronous callback lifetime; release is attempted on either outcome, and failure reports leave recovery to the lock generation's owner-exit protocol.
 */
export function runHoldingLock<T>(
  work: () => T,
  release: () => void,
  onReleaseFailure: (error: unknown) => void,
): T {
  let result: T;
  try {
    result = work();
  } catch (error) {
    releaseReporting(release, onReleaseFailure);
    throw error;
  }
  releaseReporting(release, onReleaseFailure);
  return result;
}

function releaseReporting(
  release: () => void,
  onReleaseFailure: (error: unknown) => void,
): void {
  try {
    release();
  } catch (error) {
    onReleaseFailure(error);
  }
}
