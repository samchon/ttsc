import { assertTransformAbsolutizesPluginConfigPaths } from "../../internal/transform-compiler-options";

/**
 * Verifies transformTtsc absolutizes relative plugin config paths in the
 * generated tsconfig.
 *
 * The generated tsconfig is written to a temp directory outside the project
 * root. If a plugin descriptor carries a relative `config` path it would
 * resolve against the temp dir rather than the project root, silently loading
 * the wrong file or failing with ENOENT. This pins that `transformTtsc`
 * resolves relative config paths to absolute paths before writing the temp
 * tsconfig.
 *
 * 1. Create a fixture project with no plugins in its tsconfig.
 * 2. Write a `fixture.config.json` at the project root.
 * 3. Call `transformTtsc` with an inline plugin that carries a relative `config:
 *    "./fixture.config.json"` and uses the `assert-config-path` operation so
 *    the plugin itself verifies the path is absolute.
 * 4. Assert the transform succeeds and the output contains the plugin marker.
 */
export const test_transformttsc_absolutizes_relative_plugin_config_paths_in_generated_tsconfig =
  async () => {
    await assertTransformAbsolutizesPluginConfigPaths();
  };
