import { assertTransformUsesProjectOption } from "../../internal/transform-project-option/assertTransformUsesProjectOption";

/**
 * Verifies that `transformTtsc` uses an explicit absolute `project` path
 * instead of auto-discovering `tsconfig.json`, allowing the adapter to point at
 * a bundler-specific tsconfig.
 */
export async function test_transformttsc_uses_the_project_option_for_an_alternate_tsconfig(): Promise<void> {
  await assertTransformUsesProjectOption();
}
