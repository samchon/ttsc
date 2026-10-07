import { assertWithTtscPublishesWorkerEnv } from "../../internal/metro-config";

/**
 * Verifies withTtsc publishes resolved options to the worker env.
 *
 * WithTtsc runs in the Metro config process, but the transformer runs in
 * Metro's worker processes, which never see the call. The options therefore
 * have to travel through the inherited `TTSC_METRO_OPTIONS` env var; if
 * withTtsc failed to publish them, worker-side overrides (project, plugins,
 * include/exclude) would be silently lost.
 *
 * 1. Call withTtsc with `project` and `exclude` options and assert the env JSON
 *    carries them plus a 32-hex `__snapshotRunId` that resolveOptionsFromEnv
 *    reads back.
 * 2. Call withTtsc again with no options.
 * 3. Assert the env JSON then has exactly one key, `__snapshotRunId`, holding a
 *    32-hex id.
 *
 * @evidence contracts/testing.md#behavioral-verification withTtsc with project and exclude options leaves TTSC_METRO_OPTIONS holding those values and a 32-hex __snapshotRunId that resolveOptionsFromEnv returns as snapshotRunId; a following call with no options replaces it with a payload whose only key is __snapshotRunId.
 * @evidence contracts/testing.md#independent-expectations The authored option values are compared literally against the parsed JSON, the run id against the documented 32-hex pattern, and the default payload against the exact key list ["__snapshotRunId"]; resolveOptionsFromEnv is used only to confirm the worker side reads the same id.
 * @evidence contracts/testing.md#distinguishing-cases A call with explicit options is contrasted with a subsequent default call in the same process, so options left over from the first call would fail the exact-keys check.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls withTtsc and resolveOptionsFromEnv from packages/metro source in-process on a temp projectRoot, restoring TTSC_METRO_OPTIONS and the transform-session variables afterwards; no native compile, consumer install or Metro host.
 */
export const test_withttsc_publishes_resolved_options_to_the_worker_env =
  async () => {
    await assertWithTtscPublishesWorkerEnv();
  };
