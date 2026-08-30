import { assertWithTtscChainsAnExistingTransformer } from "../../internal/metro-config";

/**
 * Verifies a transformer the config already declared is chained, not replaced.
 *
 * See {@link assertWithTtscChainsAnExistingTransformer}: `withTtsc` overwrote
 * `babelTransformerPath` without reading it, so a project using
 * `react-native-svg-transformer` lost it silently (samchon/ttsc#1321).
 */
export const test_withttsc_chains_an_existing_transformer = async () => {
  await assertWithTtscChainsAnExistingTransformer();
};
