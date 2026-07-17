import { assertCompletenessKeepsExternalCacheValidation } from "../../internal/transform-complete";

/**
 * Verifies a `dependenciesComplete` declaration does not narrow the project
 * transform cache's out-of-walk validation: an undeclared external graph member
 * still replaces the cached generation.
 *
 * Pins the scope decision of samchon/ttsc#720. The narrowing is per file and
 * lands at the bundler boundary, where persistent caches and watch graphs read
 * it. This cache replays one whole envelope, so its validity condition is the
 * union over every file the envelope carries; it is also the layer that re-runs
 * the plugin's analysis, which is the only way a widened declaration is ever
 * learned. Narrowing it too would make a stale declaration self-perpetuating
 * for the life of a long-lived host.
 *
 * 1. Transform through a graph naming an out-of-project declaration, with
 *    `src/main.ts` declared complete and that file undeclared.
 * 2. Edit the external file and transform again against the same cache.
 * 3. Assert the cached generation was replaced.
 */
export const test_transformttsc_completeness_keeps_external_project_cache_validation =
  async () => {
    await assertCompletenessKeepsExternalCacheValidation();
  };
