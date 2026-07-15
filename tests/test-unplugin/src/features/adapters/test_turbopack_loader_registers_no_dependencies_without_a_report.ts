import { assertTurbopackLoaderRegistersNoDependenciesWithoutReport } from "../../internal/adapter-turbopack";

/**
 * Verifies the Turbopack loader registers nothing when a plugin reports no
 * dependencies (#666).
 *
 * The negative twin of dependency registration: a transform whose plugin never
 * reports a `dependencies` envelope field must not fabricate loader
 * dependencies, or it would pollute Turbopack's invalidation graph and force
 * needless reruns. The module must still transform normally.
 *
 * 1. Build the default fixture (no `emit-dependencies` operation).
 * 2. Invoke the loader with a context that records `addDependency` calls.
 * 3. Assert the module transformed and no dependencies were registered.
 */
export const test_turbopack_loader_registers_no_dependencies_without_a_report =
  async () => {
    await assertTurbopackLoaderRegistersNoDependenciesWithoutReport();
  };
