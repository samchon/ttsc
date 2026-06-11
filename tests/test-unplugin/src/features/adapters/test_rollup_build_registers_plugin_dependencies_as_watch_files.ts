import { assertRollupBuildRegistersDependencyWatchFiles } from "../../internal/transform-dependencies";

/**
 * Verifies a real rollup build registers plugin-reported dependencies as watch
 * files.
 *
 * End-to-end wiring for samchon/ttsc#214: the fixture plugin's envelope
 * `dependencies` must travel through `TtscCompiler.transform()`, the unplugin
 * transform hook, and `this.addWatchFile` into rollup's `bundle.watchFiles` —
 * the channel rollup/vite watch mode consumes for invalidation. An adapter that
 * dropped the hook would pass the unit tests but never invalidate in a real
 * bundler.
 *
 * 1. Create a project whose tsconfig plugin runs `emit-dependencies` with a
 *    project-relative path.
 * 2. Run a real rollup build with the unplugin rollup adapter.
 * 3. Assert the transformed output and that `bundle.watchFiles` contains the
 *    absolutized dependency.
 */
export const test_rollup_build_registers_plugin_dependencies_as_watch_files =
  async () => {
    await assertRollupBuildRegistersDependencyWatchFiles();
  };
