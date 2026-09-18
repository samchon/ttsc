/**
 * Render a millisecond duration for lock diagnostics (`137ms`, `42s`, `9m 3s`).
 *
 * Total over every number: no caller produces a non-finite duration anymore
 * (the lock state machine reports "released" instead of an Infinity age), but
 * as defense in depth a non-finite input renders as `an unknown time` so no
 * public diagnostic can ever print `Infinitym NaNs` again (issue #421).
 *
 * Exported for unit tests.
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
