import { assertAdapterEntrypointsExposeFactories } from "../../internal/adapter-entrypoints";

/**
 * Verifies adapter entrypoints expose the expected plugin factories.
 *
 * The farm, rolldown, rspack, and webpack adapters are lower-traffic paths that
 * could silently drop their factory exports across a build-config change. This
 * pins that every bundler-specific entrypoint resolves to a callable factory,
 * catching missing re-exports before they reach consumers.
 *
 * 1. Load the farm, rolldown, rspack, and webpack adapter modules via
 *    `TestUnpluginRuntime.loadUnpluginAdapter`.
 * 2. Assert each resolved value is a function (callable factory).
 */
export const test_adapter_entrypoints_expose_the_expected_plugin_factories =
  async () => {
    await assertAdapterEntrypointsExposeFactories();
  };
