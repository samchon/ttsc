import { assertEsbuildAdapterTransformsSource } from "../../internal/adapter-esbuild";

/**
 * Verifies esbuild adapter runs the configured ttsc source transform.
 *
 * The esbuild adapter bridges unplugin's transform hook to `transformTtsc`. A
 * broken wiring between the esbuild plugin API and the ttsc transform would
 * silently pass through untransformed source. This pins that running a real
 * esbuild build with the unplugin esbuild adapter produces plugin-transformed
 * output.
 *
 * 1. Load the esbuild adapter and create a fixture project.
 * 2. Run `esbuild.build` with the adapter registered as a plugin.
 * 3. Assert the in-memory output file contains the expected plugin marker.
 */
export const test_esbuild_adapter_runs_the_configured_ttsc_source_transform =
  async () => {
    await assertEsbuildAdapterTransformsSource();
  };
