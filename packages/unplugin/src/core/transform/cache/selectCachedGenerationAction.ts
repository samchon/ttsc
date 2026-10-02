import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { isVolatileFile } from "../envelope/isVolatileFile";
import { matchesCachedSource } from "../validation/matchesCachedSource";
import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";
import type { TtscTransformCache } from "./TtscTransformCache";
import { evictGeneration } from "./evictGeneration";

/**
 * Select the delivery action for an awaited project generation.
 *
 * The caller owns awaiting, Promise-ownership checks and required native
 * notification settling. A volatile or mismatching generation is evicted by identity;
 * if eviction exposed a sibling replacement, the caller retries that entry.
 * Otherwise the caller must capture a new generation. A serving decision does
 * not perform output selection or host notification, which remain with delivery.
 *
 * @evidence contracts/common.md#principled-implementation The actual generation's volatility and recorded source proof decide serving; identity-guarded eviction then distinguishes a sibling's current replacement from an empty capture slot.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous operation selects serve/retry/capture and owns mismatch eviction, while its production caller owns awaiting, notification settling, native capture and output delivery.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Decisions inspect the supplied actual generation and validators without fabricating a producer result, capability or success; no injectable compiler callback or test-only branch is introduced.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the caller's awaited-Promise and settled-notification responsibilities and separates the decision from producer and delivery effects.
 * @evidence contracts/performance.md#efficient-algorithms A decision performs one volatility lookup and the exact source validator already required for delivery; eviction and replacement lookup are constant-time cache operations apart from delegated generation cleanup.
 * @evidence contracts/performance.md#reuse-equivalent-work A valid generation is served only under its source and dependency proof; a replacement retries the authoritative existing Promise instead of starting another capture.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Mismatching generations use the standard identity-guarded eviction/disposer; this operation stores no state or handles beyond those owned by the cache and generation.
 * @evidence contracts/portability.md#os-neutral-implementation Generation derivation and source validation retain their actual filesystem identity and compiler policy; this coordinator adds no platform inference or path rewriting.
 */
export function selectCachedGenerationAction(props: {
  cache: TtscTransformCache | undefined;
  cached: TtscCachedProjectTransform;
  epoch: number | undefined;
  file: string;
  generation: Promise<TtscCachedProjectTransform>;
  key: string;
  source: string;
}): "serve" | "retry" | "capture" {
  if (
    !isVolatileFile(envelopeDerivation(props.cached), {
      file: props.file,
      projectRoot: props.cached.projectRoot,
      result: props.cached.result,
    }) &&
    matchesCachedSource(props.cached, props.file, props.source, props.epoch)
  ) {
    return "serve";
  }
  evictGeneration(props.cache, props.key, props.generation);
  return props.cache?.get(props.key) !== undefined ? "retry" : "capture";
}
