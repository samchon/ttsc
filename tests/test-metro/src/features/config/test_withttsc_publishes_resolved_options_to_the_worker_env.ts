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
 * 1. Call withTtsc with explicit options and assert the env var holds their JSON.
 * 2. Call withTtsc with no options.
 * 3. Assert the env var is the explicit empty payload `"{}"`, never undefined.
 *
 * @evidence contracts/testing.md#behavioral-verification withTtsc publishes project/exclude options plus a valid private run identity, then replaces them with only that identity when options are absent.
 * @evidence contracts/testing.md#independent-expectations JSON worker transport preserves authored values and documented 32-hex run IDs; the options resolver must see the same published handshake.
 * @evidence contracts/testing.md#distinguishing-cases Explicit options contrast a subsequent default call, detecting stale environment overlay retention.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_withttsc_publishes_resolved_options_to_the_worker_env =
  async () => {
    await assertWithTtscPublishesWorkerEnv();
  };
