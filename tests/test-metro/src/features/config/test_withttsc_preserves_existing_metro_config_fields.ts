import { assertWithTtscPreservesExistingConfig } from "../../internal/metro-config";

/**
 * Verifies withTtsc preserves existing Metro config fields.
 *
 * Real Metro configs (especially Expo's `getDefaultConfig`) carry many resolver
 * and transformer settings. withTtsc must add only `babelTransformerPath` and
 * leave everything else — including existing `transformer` fields — intact,
 * rather than replacing the transformer block wholesale.
 *
 * 1. Wrap a config carrying unrelated top-level keys and existing transformer
 *    fields.
 * 2. Assert the unrelated keys and existing transformer fields survive unchanged.
 * 3. Assert the original object was not mutated in place.
 */
export const test_withttsc_preserves_existing_metro_config_fields =
  async () => {
    await assertWithTtscPreservesExistingConfig();
  };
