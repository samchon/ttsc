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
