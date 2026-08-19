import { assertComposedPluginsKeepTheWiderBound } from "../../internal/transform-linked-completeness";

/**
 * Verifies a declaring plugin beside a silent one keeps the union bound.
 *
 * Completeness is per (plugin, file) and a consumer cannot attribute one
 * plugin's reported inputs back to it, so the host lists a file only when every
 * contributing plugin declared it. Aggregating any other way would let one
 * plugin's claim narrow what another plugin actually consulted
 * (samchon/ttsc#1263).
 *
 * 1. Build a project whose entry imports a type-only sibling, wired to
 *    `@ttsc/banner` and `@ttsc/paths` together.
 * 2. Transform the entry and collect the derived watch inputs.
 * 3. Assert the sibling is still registered.
 */
export const test_transformttsc_composed_plugins_keep_the_wider_bound =
  async () => {
    await assertComposedPluginsKeepTheWiderBound();
  };
