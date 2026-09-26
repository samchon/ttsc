import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * The case policy the last generation of each cache key reported
 * (`IReferenceGraph.useCaseSensitiveFileNames`), which primes the key's next
 * walk before its compile reports one (samchon/ttsc#1545).
 *
 * A compile reports the policy only in its envelope, and a walk primed with
 * another one is taken again. The policy outlives the generation here, like the
 * dependency paths (`TRANSFORM_CACHE_DEPENDENCY_WITNESSES`), so a project
 * learns it once per cache rather than once per compile.
 */
export const TRANSFORM_CACHE_CASE_POLICIES = new WeakMap<
  TtscTransformCache,
  Map<string, boolean>
>();
