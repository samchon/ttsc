import { assertEmptyCustomPathFallsBackToAutoDetect } from "../../internal/metro-upstream-decisions";

/**
 * Verifies an empty-string custom path falls back to auto-detection.
 *
 * `upstreamTransformer: ""` is treated as "not configured": the resolver must
 * skip the custom-path branch (rather than try to resolve `""`) and proceed to
 * auto-detection.
 *
 * 1. Resolve with `customPath = ""`.
 * 2. Assert the first auto-detect candidate is chosen.
 *
 * @evidence contracts/testing.md#behavioral-verification An empty configured upstream path selects Expo through ordinary auto-detection.
 * @evidence contracts/testing.md#independent-expectations The documented empty-option behavior and literal Expo specifier supply an independent expected selected transformer.
 * @evidence contracts/testing.md#distinguishing-cases Empty custom path contrasts populated custom paths in real-loader boundary cases.
 * @evidence contracts/testing.md#execution-ownership This named src/unit export executes authored Metro decisions in the source-unit Node process; fixture callbacks supply resolver results and no compiled package, native build, install or host starts.
 */
export const test_upstream_empty_custom_path_falls_back_to_auto_detect =
  async () => {
    await assertEmptyCustomPathFallsBackToAutoDetect();
  };
