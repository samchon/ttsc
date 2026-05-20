import { assertTransformUsesRelativeProjectOption } from "../../internal/transform-project-option";

/**
 * Verifies transformTtsc resolves a relative project option from cwd.
 *
 * Bundler users may set `project: "tsconfig.unplugin.json"` as a relative path
 * without knowing the absolute project root. If `transformTtsc` resolved
 * relative paths against the file being transformed rather than `process.cwd`,
 * the tsconfig lookup would silently fail or pick the wrong file. This pins
 * that a bare filename in the `project` option is resolved against the current
 * working directory.
 *
 * 1. Create a fixture project with no plugins and write `tsconfig.unplugin.json`
 *    that activates the fixture plugin.
 * 2. Change `process.cwd()` to the project root.
 * 3. Call `transformTtsc` with `project: "tsconfig.unplugin.json"` (relative).
 * 4. Assert the transform succeeds and the output contains the plugin marker.
 */
export const test_transformttsc_resolves_a_relative_project_option_from_cwd =
  async () => {
    await assertTransformUsesRelativeProjectOption();
  };
