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
 *
 * @evidence contracts/testing.md#behavioral-verification Initial and cached native deliveries both replay the same exact declared dependency/universal watch list.
 * @evidence contracts/testing.md#independent-expectations The authored dependency list and fixture host-path list define expected registrations before hook execution.
 * @evidence contracts/testing.md#distinguishing-cases Cold capture and cache hit each require registration; returning output alone cannot satisfy the hook contract.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_notifies_watch_files_on_cached_transforms in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Initial and cached native deliveries both replay the same exact declared dependency/universal watch list. These assertions remain in test_transformttsc_notifies_watch_files_on_cached_transforms, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
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
