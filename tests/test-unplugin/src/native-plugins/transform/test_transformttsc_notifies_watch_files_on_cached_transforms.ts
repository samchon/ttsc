import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/transform-dependencies/emitDependenciesPlugins";
import { fixtureHostInputs } from "../../internal/transform-dependencies/fixtureHostInputs";

/**
 * Verifies a cache-served transform still notifies the watch hook: watch
 * registrations are per build/module request, while the compiler result is
 * shared, so a cache hit must replay the dependency list.
 */
export async function test_transformttsc_notifies_watch_files_on_cached_transforms(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = resolveOptions({
    plugins: emitDependenciesPlugins(["src/types.d.ts"]),
  });
  const cache = createTtscTransformCache();
  const expected = [
    path.join(root, "src", "types.d.ts"),
    ...fixtureHostInputs(root),
  ];

  const first: string[] = [];
  await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    { addWatchFile: (file: string) => first.push(file) },
  );
  assert.deepEqual([...first].sort(), [...expected].sort());

  const second: string[] = [];
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    { addWatchFile: (file: string) => second.push(file) },
  );
  assert.ok(result);
  assert.deepEqual([...second].sort(), [...expected].sort());
}
