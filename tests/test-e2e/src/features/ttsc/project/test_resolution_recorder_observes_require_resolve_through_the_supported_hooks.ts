import { runSupportedResolutionRecorderProfile } from "../../../internal/ttsc/internal/runSupportedResolutionRecorderProfile";

/**
 * Verifies the shared resolution recorder records a `require.resolve` a config
 * makes, wrapping no private loader slot.
 *
 * The banner and strip config loaders each replaced `Module._resolveFilename`
 * to record resolutions a resolve hook missed (samchon/ttsc#1523). A resolve
 * hook sees every `import` and `require()`; only `require.resolve` bypasses it,
 * and only on some releases. The maintained recorder uses the public hook and
 * marks observations incomplete where `require.resolve` does not consult it.
 * This entry used to expect a private wrapper on that branch, which the
 * maintained recorder deliberately no longer installs, so it runs the supported
 * profile instead.
 *
 * 1. In a child process, probe whether `require.resolve` consults a public hook.
 * 2. Let a recorder observe a present file and a missing candidate.
 * 3. Assert no private slot was wrapped, and that a complete observation holds the
 *    present file's content and the missing candidate proven absent, while an
 *    incomplete one is reported exactly where the hook was not consulted.
 *
 * @evidence contracts/testing.md#behavioral-verification The supported profile runs the maintained recorder in an actual Node child and judges its resolution, completeness and private-slot outcomes.
 * @evidence contracts/testing.md#independent-expectations The child's own public-hook probe, the literal present bytes and the absent candidate establish the expectations independently of the recorder.
 * @evidence contracts/testing.md#distinguishing-cases A Node whose require.resolve consults the hook must yield complete hashes; one that does not must yield an incomplete observation, never a private wrapper.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch runs this entry, which calls runSupportedResolutionRecorderProfile.
 * @evidence contracts/e2e.md#necessary-boundary Public hook dispatch and the recorder must share one actual Node process; an isolated recorder unit cannot establish that connection.
 * @evidence contracts/e2e.md#shared-execution One child performs the probe and the observation; no compiler build or installation is added.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The profile allocates a fresh tracked root and retains it before using its physical spelling.
 * @evidence contracts/e2e.md#preserved-coverage The present-hash and missing-null assertions are kept for every complete observation; only the private-wrapper expectation the maintained recorder retired is replaced by its nonreplacement.
 */
export const test_resolution_recorder_observes_require_resolve_through_the_supported_hooks =
  (): void => runSupportedResolutionRecorderProfile();
