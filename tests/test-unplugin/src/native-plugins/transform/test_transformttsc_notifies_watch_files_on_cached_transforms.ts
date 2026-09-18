import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/transform-dependencies/emitDependenciesPlugins";
import { fixtureHostInputs } from "../../internal/transform-dependencies/fixtureHostInputs";

/**
 * Verifies a cache-served transform still notifies the watch hook.
 *
 * Watch registration belongs to each build or module request, while the
 * compiler result is shared. A cache hit that skipped the replay would leave
 * every later request without its dependencies registered.
 *
 * 1. Configure a plugin that reports `src/types.d.ts`.
 * 2. Transform the entry twice through one cache, recording registrations.
 * 3. Assert both registered the same dependency list.
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
