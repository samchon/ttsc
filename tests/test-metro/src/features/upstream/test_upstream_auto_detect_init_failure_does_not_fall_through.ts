import { assertAutoDetectInitFailureDoesNotFallThrough } from "../../internal/metro-upstream-decisions";

/**
 * Verifies auto-detection does not fall through when a resolvable candidate
 * throws during initialization.
 *
 * Pins the loop guard in `resolveUpstreamTransformer`: a broken but installed
 * Expo transformer must surface its own failure, not silently select the later
 * legacy React Native candidate and run the wrong stack. The negative twin of
 * priority-order fall-through, where the earlier candidate is broken rather
 * than absent.
 *
 * 1. Inject a loader where the Expo candidate throws and later candidates load.
 * 2. Resolve with no explicit path.
 * 3. Assert it throws the Expo failure with cause, not the legacy candidate or the
 *    terminal "install one of these" message.
 *
 * @evidence contracts/testing.md#behavioral-verification With an injected loader that throws Error("expo transformer boom") for @expo/metro-config/babel-transformer and returns stubs for the other candidates, resolveUpstreamTransformer throws an error naming the Expo specifier whose cause is that Error, not the terminal not-found message and not the legacy specifier.
 * @evidence contracts/testing.md#independent-expectations The authored boom sentinel and the literal Expo and legacy specifiers identify the failure; the later candidates deliberately load successfully, so a fall-through would return one of them instead of throwing.
 * @evidence contracts/testing.md#distinguishing-cases Only an initialization failure of the first candidate is run; genuine absence and priority-order fall-through are asserted by other entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveUpstreamTransformer from packages/metro/src/core/upstream.ts in-process with an injected loader callback; no module is required from disk, and no compile, install or Metro host is involved.
 */
export const test_upstream_auto_detect_init_failure_does_not_fall_through =
  async () => {
    await assertAutoDetectInitFailureDoesNotFallThrough();
  };
