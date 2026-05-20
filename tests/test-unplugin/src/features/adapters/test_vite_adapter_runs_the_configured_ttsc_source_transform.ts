import { assertViteAdapterTransformsSource } from "../../internal/adapter-vite";

/**
 * Verifies vite adapter runs the configured ttsc source transform.
 *
 * The vite adapter bridges unplugin's transform hook to `transformTtsc`. A
 * broken wiring between the Vite plugin API and the ttsc transform would
 * silently pass through untransformed source. This pins that running a real
 * Vite build with the unplugin vite adapter produces plugin-transformed
 * output.
 *
 * 1. Load the vite adapter and create a fixture project.
 * 2. Run `vite build` with the adapter registered as a plugin and output kept in
 *    memory (`write: false`).
 * 3. Collect all chunk code from the output array.
 * 4. Assert the combined output contains the expected plugin marker.
 */
export const test_vite_adapter_runs_the_configured_ttsc_source_transform =
  async () => {
    await assertViteAdapterTransformsSource();
  };
