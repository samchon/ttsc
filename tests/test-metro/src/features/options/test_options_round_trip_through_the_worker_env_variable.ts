import { assertOptionsRoundTripThroughEnv } from "../../internal/metro-options";

/**
 * Verifies options round-trip through the worker env variable.
 *
 * The worker transformer reconstructs its configuration solely from the
 * serialized env payload. Every field — the ttsc overlay (project,
 * compilerOptions, plugins) and the Metro-specific include/exclude/
 * upstreamTransformer — must survive the serialize → env → resolve trip, or a
 * caller's override would be dropped inside the worker.
 *
 * 1. Serialize a fully-populated option set into the env var.
 * 2. Resolve it back with resolveOptionsFromEnv.
 * 3. Assert every field matches the original.
 */
export const test_options_round_trip_through_the_worker_env_variable =
  async () => {
    await assertOptionsRoundTripThroughEnv();
  };
