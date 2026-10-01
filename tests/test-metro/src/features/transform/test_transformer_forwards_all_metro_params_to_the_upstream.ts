import { assertForwardsAllParamsToUpstream } from "../../internal/metro-transform";

/**
 * Verifies the transformer forwards all Metro params to the upstream.
 *
 * Metro passes more than `src`/`filename` to a transformer (`options`, sibling
 * fields like `plugins`). The adapter replaces only `src` and must forward the
 * rest verbatim, or Metro's downstream Babel stage loses its inputs.
 *
 * 1. Run the transformer with extra `options` and a `plugins` field.
 * 2. Assert the upstream received the exact `options` object.
 * 3. Assert the upstream received the sibling `plugins` field.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored transformer forwards hot/platform options and Babel plugin descriptors through JavaScript pass-through.
 * @evidence contracts/testing.md#independent-expectations Metro upstream parameters must retain the literal ios/hot and plugin-array values supplied by the caller.
 * @evidence contracts/testing.md#distinguishing-cases Sibling parameter preservation complements source/filename assertions and the native transformed-source boundary.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_transformer_forwards_all_metro_params_to_the_upstream =
  async () => {
    await assertForwardsAllParamsToUpstream();
  };
