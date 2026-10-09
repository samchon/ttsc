/**
 * Observe a condition while its actual owner remains available.
 *
 * Polling schedules inspection without defining a completion deadline. The
 * predicate must accept only a qualified publication. The caller supplies
 * a terminal check for an unmet condition and a cancellation signal, and still
 * owns original process/native joins before releasing observed inputs.
 * Failure keeps its original cause under the named observation. Cancellation
 * stops this observation; it does not certify that an in-flight predicate's
 * underlying operation or its descendants have retired.
 *
 * @evidence contracts/common.md#principled-implementation Only the real predicate result, its actual exception, an owning terminal check or AbortSignal settles observation; clock age supplies no result.
 * @evidence contracts/common.md#clear-and-simple-design One predicate loop owns its polling handle and abort listener; callers retain their concrete producer and restoration operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Calls original callbacks and the supported AbortSignal without duration overrides, synthetic progress or foreign-method replacement.
 * @evidence contracts/common.md#meaningful-documentation Explains terminal checks, original causes and the distinction between cancelling observation and retiring its producer.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The operation schedules JavaScript callbacks and observes AbortSignal; caller predicates own native paths, process generations and platform capabilities.
 * @evidence contracts/performance.md#efficient-algorithms Serial predicate calls retain one timer and abort listener per observation; predicate cost remains with the concrete caller.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Predicates may observe different effectful owners and are not memoized or shared; each caller controls its own lifetime.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Completion, failure and abort clear the pending timer and listener once. A predicate already executing remains its underlying owner's responsibility and cannot rearm polling after settlement.
 */
export function waitFor(
  predicate: () => boolean | Promise<boolean>,
  what: string,
  owner: { check?: () => void; signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (failed: boolean, cause?: unknown): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      owner.signal?.removeEventListener("abort", abort);
      if (failed) reject(new Error(what, { cause }));
      else resolve();
    };
    const abort = (): void => settle(true, owner.signal?.reason);
    const inspect = async (): Promise<void> => {
      if (settled) return;
      try {
        owner.signal?.throwIfAborted();
        if (await predicate()) settle(false);
        else if (!settled) {
          owner.check?.();
          if (!settled) timer = setTimeout(() => void inspect(), 100);
        }
      } catch (cause) {
        settle(true, cause);
      }
    };
    owner.signal?.addEventListener("abort", abort, { once: true });
    void inspect();
  });
}
