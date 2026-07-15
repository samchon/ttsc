import { assertTurbopackLoaderTransformsWithoutAddDependency } from "../../internal/adapter-turbopack";

/**
 * Verifies the Turbopack loader transforms even when the context omits
 * `addDependency` (#666).
 *
 * `addDependency` is part of the webpack loader context contract, but a minimal
 * stub context or a Turbopack build predating the method may not expose it. The
 * dependency channel is a best-effort enhancement, so its absence must not
 * prevent the transform from running or throw.
 *
 * 1. Build the `emit-dependencies` fixture reporting a dependency.
 * 2. Invoke the loader with a context that deliberately omits `addDependency`.
 * 3. Assert the module still transforms and nothing is registered.
 */
export const test_turbopack_loader_transforms_without_an_add_dependency_context =
  async () => {
    await assertTurbopackLoaderTransformsWithoutAddDependency();
  };
