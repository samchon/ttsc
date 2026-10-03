/**
 * Render a millisecond duration for lock diagnostics (`137ms`, `42s`, `9m 3s`).
 *
 * Total over every number: the lock state machine reports "released" instead
 * of an Infinity age, and as defense in depth a non-finite input renders as
 * `an unknown time` so no public diagnostic prints `Infinitym NaNs`.
 *
 * @evidence contracts/common.md#principled-implementation Finite durations are decomposed into milliseconds or whole seconds/minutes; negative short values clamp to zero and nonfinite values use an explicit unknown-duration message.
 * @evidence contracts/common.md#clear-and-simple-design One numeric formatter owns all diagnostic duration spellings without a second lock-state representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The nonfinite branch addresses an unsupported numeric duration directly rather than preserving an infinite-age encoding beneath another lock wrapper.
 * @evidence contracts/common.md#meaningful-documentation Native prose gives millisecond/second/minute examples and explains the unknown-time result.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This performs a fixed number of scalar arithmetic and formatting operations, with no workload-dependent algorithm choice.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The function formats one diagnostic value and stores no shared computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned string survives the call; no retained resource is acquired.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation formatDuration computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) {
    return "an unknown time";
  }
  if (ms < 1_000) {
    return `${Math.max(0, Math.round(ms))}ms`;
  }
  const seconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${remainder}s`;
}
