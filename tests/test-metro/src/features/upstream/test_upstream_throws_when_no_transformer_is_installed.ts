import { assertThrowsWhenNoUpstreamInstalled } from "../../internal/metro-upstream";

/**
 * Verifies upstream resolution throws when no transformer is installed.
 *
 * If none of the candidate transformers resolve, the adapter must fail with a
 * clear, actionable error rather than returning undefined and crashing later
 * deep inside a transform.
 *
 * 1. Resolve with a loader that resolves nothing.
 * 2. Assert it throws "Could not find an upstream Metro transformer".
 */
export const test_upstream_throws_when_no_transformer_is_installed =
  async () => {
    await assertThrowsWhenNoUpstreamInstalled();
  };
