import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/transform-dependencies/emitDependenciesPlugins";
import { fixtureHostInputs } from "../../internal/transform-dependencies/fixtureHostInputs";

/**
 * Verifies plugin-reported dependencies reach `addWatchFile` normalized, with
 * only the exact module spelling excluded.
 *
 * Project-relative entries must be absolutized against the project root,
 * absolute ones kept, and exact duplicates collapsed. Only the spelling being
 * transformed is dropped: a distinct lexical alias of the same file can be
 * retargeted independently, so it survives even while it currently resolves to
 * the module itself.
 *
 * 1. Create two directory links to `src` and report relative, absolute, duplicate,
 *    self, and aliased dependencies.
 * 2. Transform through the first alias and assert the registered set keeps the
 *    canonical spelling and the second alias.
 * 3. Transform the canonical module and assert it keeps both aliases instead.
 *
 * @evidence contracts/testing.md#behavioral-verification Native reported relative/absolute/duplicate/self/alias dependencies reach exact per-delivery watch lists, keeping independently retargetable aliases.
 * @evidence contracts/testing.md#independent-expectations The fixture reports a literal list and creates two links; independently constructed expected paths distinguish lexical self-exclusion from physical deduplication.
 * @evidence contracts/testing.md#distinguishing-cases Aliased delivery excludes only its exact spelling; canonical delivery retains both aliases and transformed PLUGIN output.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_forwards_plugin_dependencies_to_the_watch_hook in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Native reported relative/absolute/duplicate/self/alias dependencies reach exact per-delivery watch lists, keeping independently retargetable aliases. These assertions remain in test_transformttsc_forwards_plugin_dependencies_to_the_watch_hook, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_forwards_plugin_dependencies_to_the_watch_hook(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const absolute = path.join(root, "src", "absolute-types.d.ts");
  const firstAlias = path.join(root, "first-source-alias");
  const secondAlias = path.join(root, "second-source-alias");
  for (const alias of [firstAlias, secondAlias]) {
    fs.symlinkSync(
      path.join(root, "src"),
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
  }
  const firstAliasedMain = path.join(firstAlias, "main.ts");
  const secondAliasedMain = path.join(secondAlias, "main.ts");
  const options = resolveOptions({
    plugins: emitDependenciesPlugins([
      "src/types.d.ts",
      absolute,
      "src/types.d.ts",
      "src/main.ts",
      path.relative(root, firstAliasedMain),
      path.relative(root, secondAliasedMain),
      path.relative(root, firstAliasedMain),
    ]),
  });
  const cache = createTtscTransformCache();
  const aliasedWatched: string[] = [];
  const aliasedResult = await transformTtsc(
    firstAliasedMain,
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    { addWatchFile: (file: string) => aliasedWatched.push(file) },
  );
  assert.ok(aliasedResult);
  assert.deepEqual(
    [...aliasedWatched].sort(),
    [
      path.join(root, "src", "types.d.ts"),
      absolute,
      TestUnpluginProject.mainFile(root),
      secondAliasedMain,
      ...fixtureHostInputs(root, firstAliasedMain),
    ].sort(),
  );
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
  assert.deepEqual(
    [...watched].sort(),
    [
      path.join(root, "src", "types.d.ts"),
      absolute,
      firstAliasedMain,
      secondAliasedMain,
      ...fixtureHostInputs(root),
    ].sort(),
  );
}
