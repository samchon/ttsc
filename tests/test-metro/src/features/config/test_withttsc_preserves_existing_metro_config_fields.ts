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
 * @evidence contracts/testing.md#behavioral-verification withTtsc on a config with projectRoot, resolver.sourceExts and transformer.minifierPath/assetPlugins returns the same projectRoot, resolver, minifierPath and assetPlugins plus a string babelTransformerPath, and the original transformer object still has no babelTransformerPath.
 * @evidence contracts/testing.md#independent-expectations The caller-owned field values are authored literals compared by equality and deepEqual, and the original object's babelTransformerPath must stay undefined; this follows from the non-mutation contract rather than from the function's output.
 * @evidence contracts/testing.md#distinguishing-cases Existing unrelated top-level and transformer fields are contrasted with the newly added babelTransformerPath; the case with no transformer at all is a separate entry.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls withTtsc from packages/metro source in-process on a temp projectRoot, restoring TTSC_METRO_OPTIONS afterwards; no native compile, consumer install or Metro host.
 */
export const test_withttsc_preserves_existing_metro_config_fields =
  async () => {
    await assertWithTtscPreservesExistingConfig();
  };
