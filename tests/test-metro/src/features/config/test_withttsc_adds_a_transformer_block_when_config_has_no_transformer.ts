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
 * 1. Call withTtsc on a config that has only a `projectRoot` key.
 * 2. Assert `projectRoot` survives.
 * 3. Assert `transformer.babelTransformerPath` is a string ending in `transformer.js`.
 *
 * @evidence contracts/testing.md#behavioral-verification withTtsc({ projectRoot }) returns a config whose projectRoot is unchanged and whose transformer.babelTransformerPath is a string ending in transformer.js, without throwing on the missing transformer key.
 * @evidence contracts/testing.md#independent-expectations The expected values are literals from the Metro config contract: the caller's projectRoot string is returned verbatim and the transformer path is a string naming a transformer.js module. The assertions do not check that the file exists or is loadable.
 * @evidence contracts/testing.md#distinguishing-cases Only the absent-transformer input is run; preservation of existing transformer fields is a separate entry, and loading the built module is not exercised here.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls withTtsc from packages/metro source in-process (which runs prepareSnapshot on a temp projectRoot and sets TTSC_METRO_OPTIONS, restored afterwards); no native compile, consumer install or Metro host is started.
 */
export const test_withttsc_adds_a_transformer_block_when_config_has_no_transformer =
  async () => {
    await assertWithTtscAddsTransformerWhenAbsent();
  };
