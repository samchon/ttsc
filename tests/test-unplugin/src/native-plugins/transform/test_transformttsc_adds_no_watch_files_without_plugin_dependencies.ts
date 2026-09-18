import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { fixtureHostInputs } from "../../internal/transform-dependencies/fixtureHostInputs";

/**
 * Verifies a plugin that reports no `dependencies` makes the transform register
 * only the universal host inputs.
 *
 * Every registered path becomes something the bundler watches and invalidates
 * on. A transform that invented dependencies would rebuild modules on unrelated
 * edits, while the universal inputs (the plugin descriptor and the config
 * chain) must always be registered.
 *
 * 1. Transform with a plugin that reports no dependencies, recording every
 *    `addWatchFile` call.
 * 2. Assert the output is transformed.
 * 3. Assert the recorded paths are exactly the fixture's universal host inputs.
 */
export async function test_transformttsc_adds_no_watch_files_without_plugin_dependencies(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "go-uppercase",
        },
      ],
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.deepEqual([...watched].sort(), fixtureHostInputs(root).sort());
}
