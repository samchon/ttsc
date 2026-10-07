/**
 * Open the shared fallback poll that checks inputs no native scope can cover.
 *
 * One unreferenced interval serves an observer's fallback inputs. Its listener
 * chooses per-tick probe slices; bounded probe counts do not bound native
 * query, content-byte or affected-owner work per tick.
 *
 * @evidence contracts/common.md#principled-implementation One interval invokes fallback checks for inputs lacking native coverage, with an explicit returned close handle.
 * @evidence contracts/common.md#clear-and-simple-design The provider owns timing only; bounded sampling and changed-condition decisions remain in its listener.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The unreferenced interval invokes real checks without replacing global timers or manufacturing events.
 * @evidence contracts/common.md#meaningful-documentation The comment distinguishes shared scheduling from the bounded per-tick work owned by the observer.
 * @evidence contracts/performance.md#efficient-algorithms One 500ms interval invokes one listener per tick; observer sampling/metadata/content/topology and affected-entry work remains delegated, without a listener CPU or byte bound here.
 * @evidence contracts/performance.md#reuse-equivalent-work One observer-owned interval serves all uncovered inputs, avoiding one polling timer per path or consumer.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns one interval and its retained listener until close or process exit. Unref permits process exit but does not release the timer; close clears future ticks, without cancelling listener effects already performed or hiding listener exceptions.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Starts a timer and returns its closer; it reads no filesystem and parses no path.
 */
export function openWatchPoller(listener: () => void): { close(): void } {
  const timer = setInterval(listener, 500);
  timer.unref();
  return { close: () => clearInterval(timer) };
}
