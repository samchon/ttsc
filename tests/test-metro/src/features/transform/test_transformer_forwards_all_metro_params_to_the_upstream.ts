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
 * @evidence contracts/testing.md#behavioral-verification transform on a .js file with options { hot: true, platform: "ios" } and a sibling plugins field passes both to the fake upstream, which receives deep-equal options and plugins ["babel-plugin-foo"].
 * @evidence contracts/testing.md#independent-expectations The literal hot/platform values and plugin array are authored by the test and compared with deepEqual against what the echoing upstream saw.
 * @evidence contracts/testing.md#distinguishing-cases Forwarding is checked on the non-TypeScript pass-through path only; the TypeScript path, where only src is replaced, is not run here.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the transformer module's transform in-process against a fake CommonJS upstream that echoes its params; no native compile, consumer install or Metro host.
 */
export const test_transformer_forwards_all_metro_params_to_the_upstream =
  async () => {
    await assertForwardsAllParamsToUpstream();
  };
