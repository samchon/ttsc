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
 * @param work The work under the lock.
 * @param release Frees the lock.
 * @param onReleaseFailure Receives a release's error, which it must not throw.
 * @returns What `work` returned.
 * @throws What `work` threw.
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
