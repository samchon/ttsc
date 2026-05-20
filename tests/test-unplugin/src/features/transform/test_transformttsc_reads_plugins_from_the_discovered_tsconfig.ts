import { assertTransformReadsDiscoveredTsconfig } from "../../internal/transform-project-config";

/**
 * Verifies transformTtsc reads plugins from the discovered tsconfig.
 *
 * The default flow locates the nearest `tsconfig.json` relative to the file
 * being transformed and applies whatever plugins that tsconfig declares. If
 * tsconfig discovery were broken the transform would silently run without any
 * plugins. This also verifies that the transform does not emit a `dist/`
 * directory — the unplugin adapter must operate in single-file mode, not as a
 * full build.
 *
 * 1. Create a fixture project whose tsconfig declares the fixture plugin.
 * 2. Call `transformTtsc` with default `resolveOptions()`.
 * 3. Assert the output matches the plugin-transformed value and contains no
 *    residual `goUpper` call.
 * 4. Assert no `dist/` directory was created in the project root.
 */
export const test_transformttsc_reads_plugins_from_the_discovered_tsconfig =
  async () => {
    await assertTransformReadsDiscoveredTsconfig();
  };
