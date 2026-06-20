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
 */
export const test_transformer_forwards_all_metro_params_to_the_upstream =
  async () => {
    await assertForwardsAllParamsToUpstream();
  };
