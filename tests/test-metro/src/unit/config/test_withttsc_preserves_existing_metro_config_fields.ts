import { assertWithTtscPreservesExistingConfig } from "../../internal/metro-config";

/**
 * Verifies withTtsc preserves existing Metro config fields.
 *
 * Real Metro configs (especially Expo's `getDefaultConfig`) carry many resolver
 * and transformer settings. withTtsc must add only `babelTransformerPath` and
 * leave everything else, including existing `transformer` fields, intact,
 * rather than replacing the transformer block wholesale.
 *
 * 1. Wrap a config carrying unrelated top-level keys and existing transformer
 *    fields.
 * 2. Assert the unrelated keys and existing transformer fields survive unchanged.
 * 3. Assert the original object was not mutated in place.
 *
 * @evidence contracts/testing.md#behavioral-verification withTtsc retains projectRoot, resolver sourceExts, minifier and asset plugins without mutating the original transformer object.
 * @evidence contracts/testing.md#independent-expectations The authored Metro config fields are caller-owned values; exact preservation and absent original babelTransformerPath independently establish the contract.
 * @evidence contracts/testing.md#distinguishing-cases Existing unrelated config and transformer fields contrast the newly returned transformer path.
 * @evidence contracts/testing.md#execution-ownership This matching src/unit export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_withttsc_preserves_existing_metro_config_fields =
  async () => {
    await assertWithTtscPreservesExistingConfig();
  };
