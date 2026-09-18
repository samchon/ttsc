import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { fixtureHostInputs } from "../../internal/transform-dependencies/fixtureHostInputs";

/**
 * Verifies the negative twin: a transform whose plugin reports no
 * `dependencies` envelope field never invokes the watch hook.
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
