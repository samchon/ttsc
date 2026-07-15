import { assertBunAdapterSurvivesPluginReportedDependencies } from "../../internal/adapter-bun";

/**
 * Verifies the Bun adapter is safe for plugin-reported dependencies (#665).
 *
 * The shared transform notifies `addWatchFile` for every dependency a plugin
 * reports. The Bun adapter used to call the raw transform with an empty
 * receiver, so `this.addWatchFile` was `undefined` and any reported dependency
 * crashed the loader with `TypeError: this.addWatchFile is not a function`
 * before it could return transformed source. Bun has no per-module dependency
 * channel, so the adapter must pass an explicit no-op watch context; a valid
 * dependency list must never crash the loader.
 *
 * 1. Build the `emit-dependencies` fixture whose plugin reports a mix of relative,
 *    absolute, duplicate, and self dependency entries.
 * 2. Capture the Bun `onLoad` handler and invoke it for the main module.
 * 3. Assert the fresh transform returns plugin-transformed `ts` output without
 *    throwing, and that the subsequent cache-hit load (which replays the same
 *    dependency notification) is equally safe.
 */
export const test_bun_adapter_survives_plugin_reported_dependencies =
  async () => {
    await assertBunAdapterSurvivesPluginReportedDependencies();
  };
