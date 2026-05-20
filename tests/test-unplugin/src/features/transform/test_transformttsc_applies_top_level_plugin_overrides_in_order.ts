import { assertTransformAppliesOrderedPluginOverrides } from "../../internal/transform-plugin-overrides";

/**
 * Verifies transformTtsc applies top-level plugin overrides in order.
 *
 * The `plugins` array in `resolveOptions` is an ordered override list: each
 * entry is applied in sequence so later plugins see the output of earlier ones.
 * Reordering or skipping any plugin would silently corrupt the final output.
 * This pins that three chained fixture plugins (prefix → upper → suffix) are
 * applied in the declared order.
 *
 * 1. Create a fixture project whose tsconfig has no plugins.
 * 2. Call `transformTtsc` with three ordered plugins: `prefix` (adds "A:"),
 *    `upper` (uppercases), and `suffix` (adds ":Z").
 * 3. Assert the output contains `"A:PLUGIN:Z"`, proving all three ran in order.
 */
export const test_transformttsc_applies_top_level_plugin_overrides_in_order =
  async () => {
    await assertTransformAppliesOrderedPluginOverrides();
  };
