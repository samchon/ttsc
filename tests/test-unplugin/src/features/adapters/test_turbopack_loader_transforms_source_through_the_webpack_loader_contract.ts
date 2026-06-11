import { assertTurbopackLoaderTransformsSource } from "../../internal/adapter-turbopack";

/**
 * Verifies the turbopack loader entrypoint transforms TypeScript source through
 * the webpack loader contract.
 *
 * Implements samchon/ttsc#215: Turbopack has no JS plugin API, so unplugin
 * adapters cannot reach it — but `turbopack.rules` runs webpack loaders, and a
 * ttsc transform is loader-shaped. This pins the exact invocation surface
 * Turbopack uses (`this.async()` + `this.resourcePath`, source string in/out)
 * against the built `@ttsc/unplugin/turbopack` entrypoint, with plugins
 * discovered from the project's own tsconfig.
 *
 * 1. Create the fixture project whose tsconfig declares the Go plugin.
 * 2. Invoke the built loader with a minimal webpack loader context.
 * 3. Assert the callback receives the plugin-transformed source.
 */
export const test_turbopack_loader_transforms_source_through_the_webpack_loader_contract =
  async () => {
    await assertTurbopackLoaderTransformsSource();
  };
