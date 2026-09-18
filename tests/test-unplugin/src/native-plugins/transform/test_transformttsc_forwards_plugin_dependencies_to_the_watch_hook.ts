import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/transform-dependencies/emitDependenciesPlugins";
import { fixtureHostInputs } from "../../internal/transform-dependencies/fixtureHostInputs";

/**
 * Verifies the transform forwards plugin-reported dependencies to the
 * `addWatchFile` hook: project-relative entries absolutized against the project
 * root, absolute entries kept, exact duplicates collapsed, and only the exact
 * transformed-module spelling excluded. Distinct lexical aliases survive even
 * when they currently resolve to the transformed module itself.
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
      ...fixtureHostInputs(root),
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
