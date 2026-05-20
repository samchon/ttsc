import { assertTransformUsesPackageDiscoveredProjectPlugins } from "../../internal/transform-compiler-options";

/**
 * Verifies transformTtsc applies package-discovered project plugins.
 *
 * When a project dependency ships a `ttsc` plugin descriptor inside its package
 * metadata, `transformTtsc` must discover and apply it without any explicit
 * user configuration. A regression in discovery would silently skip all
 * package-contributed plugins. This pins that a plugin installed as a workspace
 * package under `node_modules` is auto-loaded and applied.
 *
 * 1. Create a fixture project whose tsconfig has no plugins.
 * 2. Write a package-plugin descriptor using `writePackagePlugin`.
 * 3. Call `transformTtsc` with default `resolveOptions()`.
 * 4. Assert the transform result contains the plugin output marker.
 */
export const test_transformttsc_applies_package_discovered_project_plugins =
  async () => {
    await assertTransformUsesPackageDiscoveredProjectPlugins();
  };
