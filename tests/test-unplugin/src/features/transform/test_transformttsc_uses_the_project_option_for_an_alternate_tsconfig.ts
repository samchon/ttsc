import { assertTransformUsesProjectOption } from "../../internal/transform-project-option";

/**
 * Verifies transformTtsc uses the project option for an alternate tsconfig.
 *
 * When `resolveOptions({ project })` is set to an absolute path, that tsconfig
 * should be used in place of the auto-discovered one. This allows monorepos and
 * multi-target builds to point the adapter at a bundler-specific tsconfig that
 * differs from the editor / CI tsconfig. If the `project` option were ignored,
 * the adapter would silently fall back to tsconfig discovery and pick up the
 * wrong plugin set. This pins that an explicit absolute path is honoured.
 *
 * 1. Create a fixture project with no plugins in its tsconfig.
 * 2. Write `tsconfig.unplugin.json` that extends the base tsconfig and adds the
 *    fixture plugin.
 * 3. Call `transformTtsc` with `project` set to the absolute path of that
 *    tsconfig.
 * 4. Assert the output contains the plugin marker.
 */
export const test_transformttsc_uses_the_project_option_for_an_alternate_tsconfig =
  async () => {
    await assertTransformUsesProjectOption();
  };
