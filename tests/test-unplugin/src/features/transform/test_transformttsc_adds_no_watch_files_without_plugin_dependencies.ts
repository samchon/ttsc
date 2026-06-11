import { assertTransformWithoutDependenciesAddsNoWatchFiles } from "../../internal/transform-dependencies";

/**
 * Verifies transformTtsc never invokes the watch hook when the plugin reports
 * no dependencies.
 *
 * The negative twin of the #214 forwarding test: the `dependencies` envelope
 * field is optional, and a transform that omits it must not register watch
 * files — phantom registrations would re-trigger rebuilds on unrelated file
 * changes and mask plugins that forget to report.
 *
 * 1. Run the fixture plugin with a plain `go-uppercase` operation (no dependencies
 *    in the envelope).
 * 2. Collect addWatchFile invocations through the hooks parameter.
 * 3. Assert the transform succeeded and the hook never fired.
 */
export const test_transformttsc_adds_no_watch_files_without_plugin_dependencies =
  async () => {
    await assertTransformWithoutDependenciesAddsNoWatchFiles();
  };
