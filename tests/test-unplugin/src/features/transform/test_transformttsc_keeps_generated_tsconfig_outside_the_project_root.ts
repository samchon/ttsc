import { assertGeneratedTsconfigStaysOutsideProjectRoot } from "../../internal/transform-compiler-options";

/**
 * Verifies transformTtsc keeps the generated tsconfig outside the project root.
 *
 * `transformTtsc` writes a synthetic tsconfig to a temp directory so it can
 * pass inline compiler options to the native compiler without modifying the
 * project on disk. If the temp file were written inside the project root,
 * bundler file-watching would pick it up and trigger spurious rebuilds. The
 * fixture plugin uses the `assert-temp-tsconfig-outside-project` operation to
 * verify the path of the tsconfig it received at runtime.
 *
 * 1. Create a fixture project whose tsconfig has no plugins.
 * 2. Call `transformTtsc` with a plugin that uses the
 *    `assert-temp-tsconfig-outside-project` operation.
 * 3. Assert the transform succeeds and the output contains the plugin marker.
 */
export const test_transformttsc_keeps_generated_tsconfig_outside_the_project_root =
  async () => {
    await assertGeneratedTsconfigStaysOutsideProjectRoot();
  };
