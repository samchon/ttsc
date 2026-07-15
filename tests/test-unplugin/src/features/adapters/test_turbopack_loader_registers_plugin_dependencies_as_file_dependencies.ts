import { assertTurbopackLoaderRegistersPluginDependencies } from "../../internal/adapter-turbopack";

/**
 * Verifies the Turbopack loader registers plugin-reported dependencies (#666).
 *
 * The standalone Turbopack loader transformed source but dropped the transform
 * envelope's reported dependency list, so type-only inputs a plugin consulted
 * never entered Turbopack's `fileDependencies` invalidation set and edits to
 * them could leave generated code stale. The loader must forward each reported
 * dependency through the webpack loader context's `addDependency(file)`, with
 * the same path normalization the other adapters use.
 *
 * 1. Build the `emit-dependencies` fixture reporting a mix of relative,
 *    absolute, duplicate, and self dependency entries.
 * 2. Invoke the loader with a context that records `addDependency` calls.
 * 3. Assert the module transformed and the registered paths are the absolutized,
 *    deduplicated set with the module itself excluded.
 */
export const test_turbopack_loader_registers_plugin_dependencies_as_file_dependencies =
  async () => {
    await assertTurbopackLoaderRegistersPluginDependencies();
  };
