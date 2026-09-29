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
 * @evidence contracts/performance.md#bound-retention-and-release-resources Terminal evidence is weakly keyed by the current promise, and other failures reach identity-guarded eviction and generation disposal.
 */
export async function awaitOrEvict(
  cache: TtscTransformCache | undefined,
  key: string,
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
