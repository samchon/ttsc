import { assertOptionsRoundTripThroughEnv } from "../../internal/metro-options";

/**
 * Verifies options round-trip through the worker env variable.
 *
 * The worker transformer reconstructs its configuration solely from the
 * serialized env payload. Every field, the ttsc overlay (project,
 * compilerOptions, plugins) and the Metro-specific include/exclude/
 * upstreamTransformer, must survive the serialize → env → resolve trip, or a
 * caller's override would be dropped inside the worker.
 *
 * 1. Serialize a fully-populated option set into the env var.
 * 2. Resolve it back with resolveOptionsFromEnv.
 * 3. Assert every field matches the original.
 *
 * @evidence contracts/testing.md#behavioral-verification serializeOptions and resolveOptionsFromEnv retain project, strict compiler options, plugin descriptors, include/exclude arrays and custom upstream through JSON in the actual environment.
 * @evidence contracts/testing.md#independent-expectations The authored overlay values are exact literals required by the Metro config-to-worker JSON contract; each resolved field is compared to its corresponding input.
 * @evidence contracts/testing.md#distinguishing-cases Populated options contrast defaults and plugins:false in neighboring source entries; this entry owns every supplied overlay field.
 * @evidence contracts/testing.md#execution-ownership This named src/unit/options export calls authored options source in the serial source-unit runner; the helper restores the environment after each call and starts no installed artifact, native build or child process.
 */
export const test_options_round_trip_through_the_worker_env_variable =
  async () => {
    await assertOptionsRoundTripThroughEnv();
  };
