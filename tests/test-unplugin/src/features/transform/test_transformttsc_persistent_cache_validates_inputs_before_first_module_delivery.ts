import { assertPersistentCacheValidatesAnUnservedModule } from "../../internal/transform-project-cache";

/**
 * Verifies lifecycle-less caches validate before serving an unrequested module.
 *
 * A Metro, Turbopack, or Bun-runtime cache can outlive a build. A project
 * generation may contain a lazy module that was never requested during the old
 * build, so "first delivery" alone does not prove its other inputs are fresh.
 *
 * 1. Compile a generation containing an unrequested lazy module.
 * 2. Change another project input without signaling a build start.
 * 3. Request the lazy module and assert the generation is replaced.
 */
export const test_transformttsc_persistent_cache_validates_inputs_before_first_module_delivery =
  async () => {
    await assertPersistentCacheValidatesAnUnservedModule();
  };
