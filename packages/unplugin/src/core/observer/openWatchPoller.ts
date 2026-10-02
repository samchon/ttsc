/**
 * Open the shared fallback poll that checks inputs no native scope can cover.
 *
 * One unreferenced interval serves every such input. Each tick checks a bounded
 * slice, so idle CPU cost stays constant however many inputs fall back.
 *
 * @evidence contracts/common.md#principled-implementation One interval invokes fallback checks for inputs lacking native coverage, with an explicit returned close handle.
 * @evidence contracts/common.md#clear-and-simple-design The provider owns timing only; bounded sampling and changed-condition decisions remain in its listener.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The unreferenced interval invokes real checks without replacing global timers or manufacturing events.
 * @evidence contracts/common.md#meaningful-documentation The comment distinguishes shared scheduling from the bounded per-tick work owned by the observer.
 * @evidence contracts/performance.md#efficient-algorithms The scheduler adds constant timer work per tick; the observer's listener limits sampled inputs and link probes instead of scanning its whole registration set.
 * @evidence contracts/performance.md#reuse-equivalent-work One observer-owned interval serves all uncovered inputs, avoiding one polling timer per path or consumer.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The close handle clears the sole interval and unref prevents the scheduler from retaining the host process by itself.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Starts a timer and returns its closer; it reads no filesystem and parses no path.
 */
export function openWatchPoller(listener: () => void): { close(): void } {
  const timer = setInterval(listener, 500);
  timer.unref();
  return { close: () => clearInterval(timer) };
}
