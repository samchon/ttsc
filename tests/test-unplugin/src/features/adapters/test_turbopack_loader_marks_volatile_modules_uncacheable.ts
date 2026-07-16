import { assertTurbopackLoaderMarksVolatileModulesUncacheable } from "../../internal/adapter-turbopack";

/**
 * Verifies the Turbopack loader marks a plugin-declared volatile module
 * uncacheable through the webpack loader contract's `cacheable(false)`.
 *
 * Implements the hermeticity half of samchon/ttsc#716 on the loader path: a
 * module whose output depends on non-file inputs cannot be represented by any
 * `fileDependencies` snapshot, so the loader must exclude it from caching
 * instead. The negative twin pins that ordinary transforms never touch
 * cacheability — toggling it unconditionally would disable the bundler's cache
 * for every ttsc project.
 *
 * 1. Run the loader with the fixture's `emit-volatile` operation and assert
 *    exactly one `cacheable(false)` call, bound to the loader context.
 * 2. Run the loader with a hermetic operation.
 * 3. Assert no cacheable call was made.
 */
export const test_turbopack_loader_marks_volatile_modules_uncacheable =
  async () => {
    await assertTurbopackLoaderMarksVolatileModulesUncacheable();
  };
