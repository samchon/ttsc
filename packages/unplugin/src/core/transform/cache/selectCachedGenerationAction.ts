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
 * notification settling. A volatile or mismatching generation is evicted by
 * identity; if eviction exposed a sibling replacement, the caller retries it.
 * Otherwise the caller must capture a new generation. A serving decision does
 * not perform output selection or host notification, which remain with delivery.
 *
 * @evidence contracts/common.md#principled-implementation The actual generation's volatility and recorded source proof decide serving; identity-guarded eviction then distinguishes a sibling's current replacement from an empty capture slot.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous operation selects serve/retry/capture and owns mismatch eviction, while its production caller owns awaiting, notification settling, native capture and output delivery.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Decisions inspect the supplied actual generation and validators without fabricating a producer result, capability or success; no injectable compiler callback or test-only branch is introduced.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the caller's awaited-Promise and settled-notification responsibilities and separates the decision from producer and delivery effects.
 * @evidence contracts/performance.md#efficient-algorithms
 *   First non-exception volatility lookup folds the native identity declaration;
 *   later queries reuse its Set. Source validation may hash delivered/disk text,
 *   build an output index, validate derived inputs or scan the complete recorded
 *   snapshot according to its actual proof branch. Costs follow declaration
 *   and input populations, path/source bytes and uncached native observations.
 *   Eviction adds keyed access and delegated generation cleanup, not a compile.
 * @evidence contracts/performance.md#reuse-equivalent-work A valid generation is served only under its source and dependency proof; a replacement retries the authoritative existing Promise instead of starting another capture.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Derived Sets/indexes, signatures and epoch state remain generation-owned.
 *   Mismatch transfers only the current promise through identity-guarded
 *   cleanup attempts, with their native failure and unresolved-compile limits.
 *   This action selector acquires no independent handle or historical state.
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
