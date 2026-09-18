import { assertTransformUsesRelativeProjectOption } from "../../internal/transform-project-option/assertTransformUsesRelativeProjectOption";

/**
 * Verifies that a relative `project` path in `resolveOptions` is resolved
 * against `process.cwd()`, not the file being transformed.
 *
 * Temporarily changes `process.cwd()` to the project root and restores it in a
 * `finally` block to avoid polluting subsequent tests.
 */
export async function test_transformttsc_resolves_a_relative_project_option_from_cwd(): Promise<void> {
  await assertTransformUsesRelativeProjectOption();
}
