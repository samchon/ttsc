import { assertTransformIgnoresVirtualModules } from "../../internal/transform-virtual-modules";

/**
 * Verifies transformTtsc ignores bundler virtual modules.
 *
 * Bundlers inject synthetic modules whose IDs begin with `\0` (null byte) — for
 * example, rolldown's runtime shim `\0rolldown/runtime.js`. These paths do not
 * correspond to real files and must not be passed to the ttsc transform, which
 * would fail trying to locate them on disk. The shared `transformInclude`
 * filter already excludes them, but this pins the `transformTtsc` itself so the
 * defence-in-depth path stays covered.
 *
 * 1. Call `transformTtsc` directly with a virtual-module path (`\0rolldown/...`).
 * 2. Assert the return value is `undefined` (transform skipped).
 */
export const test_transformttsc_ignores_bundler_virtual_modules = async () => {
  await assertTransformIgnoresVirtualModules();
};
