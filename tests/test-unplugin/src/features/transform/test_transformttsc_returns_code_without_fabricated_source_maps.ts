import { assertTransformResultHasNoSyntheticSourceMap } from "../../internal/transform-compiler-options";

/**
 * Verifies transformTtsc returns code without fabricated source maps.
 *
 * The unplugin adapter must not synthesize a `map` property on the transform
 * result. Returning a fabricated source map would override the bundler's own
 * source-map pipeline, producing incorrect stack traces. Only the native
 * compiler should produce source maps, and only when the user has enabled them.
 * This pins that the transform result object does not contain a `map` key.
 *
 * 1. Create a fixture project with no plugins in tsconfig.
 * 2. Call `transformTtsc` with an inline plugin via `compilerOptions.plugins`.
 * 3. Assert the result is truthy and that `"map" in result` is `false`.
 */
export const test_transformttsc_returns_code_without_fabricated_source_maps =
  async () => {
    await assertTransformResultHasNoSyntheticSourceMap();
  };
