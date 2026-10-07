import { TtscUnstableGenerationError } from "../errors/TtscUnstableGenerationError";
import { TERMINAL_TRANSFORM_GENERATIONS } from "./TERMINAL_TRANSFORM_GENERATIONS";
import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";
import type { TtscTransformCache } from "./TtscTransformCache";
import { evictGeneration } from "./evictGeneration";

/**
 * Await a cached generation, retaining only terminal proof failures.
 *
 * The cache stores the in-flight transform Promise before it settles so
 * concurrent callers share one compilation. Ordinary compiler and host
 * rejections are evicted so a transient failure cannot become permanent. A
 * bounded stabilization failure is different: it already spent its retry and
 * repeating it for every later module recreates the issue this gate prevents.
 * It stays authoritative until its retained input baseline changes or the cache
 * owner starts a new lifecycle.
 *
 * @evidence contracts/common.md#principled-implementation Only a bounded unstable-generation error belonging to the current entry is retained; ordinary rejection evicts that entry and preserves the original error.
 * @evidence contracts/common.md#clear-and-simple-design Awaiting and the rejection classification share one gate; eviction and terminal-baseline validation remain in their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Retention avoids repeated identical failed work, but never converts the error into success or makes an ordinary transient rejection permanent.
 * @evidence contracts/common.md#meaningful-documentation The prose explains promise sharing and why terminal stabilization failure differs from a retryable host rejection.
 * @evidence contracts/performance.md#efficient-algorithms Awaiting one shared promise and checking current entry identity avoids per-delivery recompilation and cache-wide failure scans.
 * @evidence contracts/performance.md#reuse-equivalent-work Concurrent callers reuse one in-flight compile; unchanged bounded stabilization failure can replay while ordinary transient rejection remains retryable.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   One terminal error is weakly associated with the current promise; its
 *   validation data grows with the captured input/witness population, without
 *   a byte bound supplied here. Other rejected promises are identity-evicted
 *   and their rejections consumed; no fulfilled generation is present to
 *   dispose on that rejection. Awaiting adds no cancellation/settlement deadline.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This gate classifies an already rejected promise by typed error and opaque
 *   cache identity. It neither reads native inputs nor interprets the error's
 *   captured paths/capabilities; terminal environment replay has that owner.
 */
export async function awaitOrEvict(
  /** Cache permitting retention only while the supplied promise is current. */
  cache: TtscTransformCache | undefined,
  /** Opaque configuration address for the identity check. */
  key: string,
  /** Already-started compile shared with concurrent callers. */
  generation: Promise<TtscCachedProjectTransform>,
): Promise<TtscCachedProjectTransform> {
  try {
    return await generation;
  } catch (error) {
    if (
      error instanceof TtscUnstableGenerationError &&
      cache?.get(key) === generation
    ) {
      TERMINAL_TRANSFORM_GENERATIONS.set(generation, error);
    } else {
      evictGeneration(cache, key, generation);
    }
    throw error;
  }
}
