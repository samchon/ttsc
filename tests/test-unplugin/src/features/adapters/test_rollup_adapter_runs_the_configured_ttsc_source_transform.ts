import { assertRollupAdapterTransformsSource } from "../../internal/adapter-rollup";

/**
 * Verifies rollup adapter runs the configured ttsc source transform.
 *
 * The rollup adapter bridges unplugin's transform hook to `transformTtsc`. A
 * broken wiring between the rollup plugin API and the ttsc transform would
 * silently pass through untransformed source. This pins that running a real
 * rollup build with the unplugin rollup adapter produces plugin-transformed
 * output.
 *
 * 1. Load the rollup adapter and create a fixture project.
 * 2. Run `rollup` with the adapter registered as a plugin.
 * 3. Generate in-memory ESM output and collect all chunk code.
 * 4. Assert the combined output contains the expected plugin marker.
 */
export const test_rollup_adapter_runs_the_configured_ttsc_source_transform =
  async () => {
    await assertRollupAdapterTransformsSource();
  };
