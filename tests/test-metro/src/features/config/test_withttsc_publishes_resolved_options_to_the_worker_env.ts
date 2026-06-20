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
 */
export const test_withttsc_publishes_resolved_options_to_the_worker_env =
  async () => {
    await assertWithTtscPublishesWorkerEnv();
  };
