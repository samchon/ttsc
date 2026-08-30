import { assertNextAdapterPreservesTurbopackConfig } from "../../internal/adapter-next";

/**
 * Verifies the Next wrapper is additive for Turbopack configuration.
 *
 * See {@link assertNextAdapterPreservesTurbopackConfig}: unrelated settings and
 * rules survive, and a caller who already wired the loader by hand, as the
 * README told them to, does not end up with it registered twice
 * (samchon/ttsc#1310).
 */
export const test_next_adapter_preserves_turbopack_config = async () => {
  await assertNextAdapterPreservesTurbopackConfig();
};
