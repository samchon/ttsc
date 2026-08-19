import { assertUnprovenCandidatesKeepOneCompile } from "../../internal/transform-project-cache";

/**
 * Verifies samchon/ttsc#1245: unproven resolution candidates keep one compile.
 *
 * A superseding candidate is a spelling ahead of the resolution target that
 * won, so the compiler never read it and no compile-time proof for it can
 * exist. Demanding one made every generation of every project with a
 * `.d.ts`-typed dependency unusable, and each refusal recompiled the whole
 * project for the next module.
 *
 * 1. Build a six-file project whose envelope stamps three unproven candidates per
 *    module.
 * 2. Transform every module through one persistent cache.
 * 3. Assert the plugin ran once.
 */
export const test_transformttsc_caches_one_compile_with_unproven_resolution_candidates =
  async () => {
    await assertUnprovenCandidatesKeepOneCompile();
  };
