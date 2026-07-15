import { assertAutoDetectInitFailureDoesNotFallThrough } from "../../internal/metro-upstream";

/**
 * Verifies auto-detection does not fall through when a resolvable candidate
 * throws during initialization.
 *
 * Pins the loop guard in `resolveUpstreamTransformer`: a broken but installed
 * Expo transformer must surface its own failure, not silently select the later
 * legacy React Native candidate and run the wrong stack. The negative twin of
 * priority-order fall-through, where the earlier candidate is broken rather than
 * absent.
 *
 * 1. Inject a loader where the Expo candidate throws and later candidates load.
 * 2. Resolve with no explicit path.
 * 3. Assert it throws the Expo failure with cause, not the legacy candidate or
 *    the terminal "install one of these" message.
 */
export const test_upstream_auto_detect_init_failure_does_not_fall_through =
  async () => {
    await assertAutoDetectInitFailureDoesNotFallThrough();
  };
