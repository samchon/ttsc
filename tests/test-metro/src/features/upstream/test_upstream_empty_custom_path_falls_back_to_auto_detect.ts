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
 * @evidence contracts/testing.md#behavioral-verification resolveUpstreamTransformer("", load) with a loader that tags every specifier returns the transformer tagged @expo/metro-config/babel-transformer.
 * @evidence contracts/testing.md#independent-expectations The expected selection is the literal first documented candidate specifier; an attempt to load the empty string would produce a different tag or a thrown error.
 * @evidence contracts/testing.md#distinguishing-cases Only the empty-string custom path is run; non-empty custom paths are covered by the real-loader entries, and later-candidate fall-through by the priority-order entry.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveUpstreamTransformer from packages/metro/src/core/upstream.ts in-process with an injected loader callback; no module is required from disk, and no compile, install or Metro host is involved.
 */
export const test_upstream_empty_custom_path_falls_back_to_auto_detect =
  async () => {
    await assertEmptyCustomPathFallsBackToAutoDetect();
  };
