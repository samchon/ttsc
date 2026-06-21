import { assertEmptyCustomPathFallsBackToAutoDetect } from "../../internal/metro-upstream";

/**
 * Verifies an empty-string custom path falls back to auto-detection.
 *
 * `upstreamTransformer: ""` is treated as "not configured": the resolver must
 * skip the custom-path branch (rather than try to resolve `""`) and proceed to
 * auto-detection.
 *
 * 1. Resolve with `customPath = ""`.
 * 2. Assert the first auto-detect candidate is chosen.
 */
export const test_upstream_empty_custom_path_falls_back_to_auto_detect =
  async () => {
    await assertEmptyCustomPathFallsBackToAutoDetect();
  };
