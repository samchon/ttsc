import { assertWithTtscAddsTransformerWhenAbsent } from "../../internal/metro-config";

/**
 * Verifies withTtsc adds a transformer block when the config has no
 * transformer.
 *
 * A Metro config need not already contain a `transformer` key. withTtsc spreads
 * `config.transformer` (possibly `undefined`) and must still produce a valid
 * `transformer.babelTransformerPath` without crashing, while preserving
 * unrelated top-level keys.
 *
 * 1. Call withTtsc on a config that has no `transformer` key.
 * 2. Assert an unrelated top-level key survives.
 * 3. Assert `transformer.babelTransformerPath` is set to the package transformer.
 */
export const test_withttsc_adds_a_transformer_block_when_config_has_no_transformer =
  async () => {
    await assertWithTtscAddsTransformerWhenAbsent();
  };
