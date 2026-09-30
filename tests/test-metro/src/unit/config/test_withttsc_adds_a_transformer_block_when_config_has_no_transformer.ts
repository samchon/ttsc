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
 *
 * @evidence contracts/testing.md#behavioral-verification withTtsc creates a transformer path when no transformer block exists while retaining projectRoot.
 * @evidence contracts/testing.md#independent-expectations Metro configuration requires a callable transformer module path and preservation of unrelated caller values; the original assertions pin returned string shape only.
 * @evidence contracts/testing.md#distinguishing-cases Missing block contrasts existing-field preservation; built-module execution belongs to the surviving CJS boundary.
 * @evidence contracts/testing.md#execution-ownership This matching src/unit export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_withttsc_adds_a_transformer_block_when_config_has_no_transformer =
  async () => {
    await assertWithTtscAddsTransformerWhenAbsent();
  };
