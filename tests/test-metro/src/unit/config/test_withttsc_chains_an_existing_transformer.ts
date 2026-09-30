import { assertWithTtscChainsAnExistingTransformer } from "../../internal/metro-config";

/**
 * Verifies a transformer the config already declared is chained, not replaced.
 *
 * See {@link assertWithTtscChainsAnExistingTransformer}: `withTtsc` overwrote
 * `babelTransformerPath` without reading it, so a project using
 * `react-native-svg-transformer` lost it silently (samchon/ttsc#1321).
 *
 * 1. Create absolute, relative, package and duplicate-self transformer fixtures.
 * 2. Configure each spelling, explicit override and double wrapping.
 * 3. Assert every published upstream adoption and refusal from the worker payload.
 *
 * @evidence contracts/testing.md#behavioral-verification withTtsc resolves absolute, relative and package upstreams, retains unresolved spellings, honors explicit override and rejects self-delegation while accepting a lookalike foreign transformer.
 * @evidence contracts/testing.md#independent-expectations Each authored fixture path/package name independently identifies its owner; the explicit override and self-reference contracts determine every published upstream.
 * @evidence contracts/testing.md#distinguishing-cases All original adoption spellings, unresolved path, explicit precedence, missing config, double wrapping, duplicate package copy, self package specifier and foreign same-filename controls remain.
 * @evidence contracts/testing.md#execution-ownership This matching src/unit export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_withttsc_chains_an_existing_transformer = async () => {
  await assertWithTtscChainsAnExistingTransformer();
};
