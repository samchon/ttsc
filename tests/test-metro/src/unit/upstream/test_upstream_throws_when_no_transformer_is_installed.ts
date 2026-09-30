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
 * @evidence contracts/testing.md#behavioral-verification resolveUpstreamTransformer throws its terminal upstream-missing diagnostic when the injected resolver admits no candidate.
 * @evidence contracts/testing.md#independent-expectations The public absence contract requires the authored Could not find an upstream Metro transformer diagnostic rather than an arbitrary throw.
 * @evidence contracts/testing.md#distinguishing-cases Complete absence contrasts positive candidate selection and initialization failure in other entries.
 * @evidence contracts/testing.md#execution-ownership This named src/unit export executes authored Metro decisions in the source-unit Node process; fixture callbacks supply resolver results and no compiled package, native build, install or host starts.
 */
export const test_upstream_throws_when_no_transformer_is_installed =
  async () => {
    await assertThrowsWhenNoUpstreamInstalled();
  };
