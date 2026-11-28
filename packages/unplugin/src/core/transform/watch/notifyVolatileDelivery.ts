import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { isVolatileFile } from "../envelope/isVolatileFile";
import type { TtscTransformHooks } from "./TtscTransformHooks";

/**
 * Notify the host of a volatile delivery or a required workspace replay when
 * its cache has opted in. A supplied callback runs with the hooks object as its
 * receiver, and its exception reaches the caller.
 *
 * @evidence contracts/common.md#principled-implementation A declared volatile file requests cache withdrawal. A required workspace replay does so only for a host that opts in to this fallback.
 * @evidence contracts/common.md#clear-and-simple-design Generation declaration matching remains with isVolatileFile, while this operation owns the conditional delivery notification used by transformTtsc.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No output-text inference or fabricated compiler declaration replaces recorded membership, and callback failures are not suppressed.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies declaration evaluation, callback receiver and exception behavior, and excludes compiler acquisition certification.
 * @evidence contracts/portability.md#os-neutral-implementation Declared and delivered paths are compared through the generation's native filesystem identity context, rather than lexical case or separator guesses.
 * @evidence contracts/performance.md#efficient-algorithms Delegated cold matching folds the declared population and resolves native identities; warm matching uses its identity set and per-spelling memo. This operation adds one conditional callback without copying or rescanning the declaration.
 * @evidence contracts/performance.md#reuse-equivalent-work The predicate shares indexes only within its immutable result/root and qualified filesystem identity snapshot. Host notification still occurs on each volatile delivery, including repeated deliveries; an absent callback does not skip the existing declaration evaluation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The operation acquires no resource and controls no retained generation lifetime; derivation state and host cache withdrawal have separate owners.
 */
export function notifyVolatileDelivery(
  hooks: TtscTransformHooks | undefined,
  cached: TtscCachedProjectTransform,
  file: string,
): void {
  if (
    (hooks?.workspaceReplayUsesVolatility === true &&
      cached.result.type !== "exception" &&
      cached.result.workspaceReplayRequired === true) ||
    isVolatileFile(envelopeDerivation(cached), {
      file,
      projectRoot: cached.projectRoot,
      result: cached.result,
    })
  ) {
    hooks?.markVolatile?.();
  }
}
