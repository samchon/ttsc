import { assertTransformPassesBundlerAliases } from "../../internal/transform-vite-aliases";

/**
 * Verifies transformTtsc passes bundler aliases through compilerOptions.paths.
 *
 * Vite and similar bundlers resolve module aliases independently of TypeScript.
 * When the unplugin adapter receives a bundler alias map it must forward it as
 * `compilerOptions.paths` so the ttsc transform can resolve the same imports
 * that the bundler would. If the alias map were dropped, the transform would
 * fail to resolve aliased imports. This pins that the alias argument is
 * forwarded and that the fixture plugin sees the expected `@lib` → absolute
 * path mapping.
 *
 * 1. Create a fixture project with no tsconfig plugins.
 * 2. Call `transformTtsc` with a plugin that uses the `assert-paths` operation and
 *    pass a bundler alias map `{ "@lib": "<abs>/src/modules" }`.
 * 3. Assert the transform succeeds and the output contains the plugin marker.
 */
export const test_transformttsc_passes_bundler_aliases_through_compileroptions_paths =
  async () => {
    await assertTransformPassesBundlerAliases();
  };
