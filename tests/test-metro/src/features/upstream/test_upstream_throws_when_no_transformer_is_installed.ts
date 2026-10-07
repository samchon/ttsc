import { assertThrowsWhenNoUpstreamInstalled } from "../../internal/metro-upstream-decisions";

/**
 * Verifies upstream resolution throws when no transformer is installed.
 *
 * If none of the candidate transformers resolve, the adapter must fail with a
 * clear, actionable error rather than returning undefined and crashing later
 * deep inside a transform.
 *
 * 1. Resolve with a loader that resolves nothing.
 * 2. Assert it throws "Could not find an upstream Metro transformer".
 *
 * @evidence contracts/testing.md#behavioral-verification resolveUpstreamTransformer(undefined, () => undefined) throws an error matching /Could not find an upstream Metro transformer/.
 * @evidence contracts/testing.md#independent-expectations The documented terminal diagnostic text is matched as a literal pattern, so an arbitrary throw or a returned undefined would fail.
 * @evidence contracts/testing.md#distinguishing-cases Only the no-candidate case is run; successful selection and initialization failure are asserted by other entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveUpstreamTransformer from packages/metro/src/core/upstream.ts in-process with an injected loader callback that finds nothing; no module is required from disk, and no compile, install or Metro host is involved.
 */
export const test_upstream_throws_when_no_transformer_is_installed =
  async () => {
    await assertThrowsWhenNoUpstreamInstalled();
  };
