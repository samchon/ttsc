import { assertTransformUsesInlineCompilerOptions } from "../../internal/transform-compiler-options";

/**
 * Verifies transformTtsc accepts compilerOptions.plugins as an inline override.
 *
 * Bundler users often cannot or do not want to edit tsconfig.json; they supply
 * plugins directly through `resolveOptions({ compilerOptions: { plugins } })`.
 * If `transformTtsc` ignored the inline `compilerOptions.plugins` field in
 * favour of the on-disk tsconfig, the override would silently have no effect.
 * This pins that an inline `compilerOptions.plugins` list takes effect even
 * when the project's own tsconfig carries no plugins.
 *
 * 1. Create a fixture project whose tsconfig has no plugins.
 * 2. Call `transformTtsc` with `compilerOptions.plugins` set inline to the fixture
 *    plugin.
 * 3. Assert the transform result contains the plugin output marker.
 */
export const test_transformttsc_accepts_compileroptions_plugins_as_an_inline_override =
  async () => {
    await assertTransformUsesInlineCompilerOptions();
  };
