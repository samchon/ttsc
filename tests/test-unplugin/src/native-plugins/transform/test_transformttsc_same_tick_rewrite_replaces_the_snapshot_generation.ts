import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { createTickPinnedFilesystem } from "../../internal/transform-project-cache/createTickPinnedFilesystem";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies the whole-snapshot path keeps its content comparison against
 * same-tick rewrites too, on both the project walk and the out-of-walk
 * re-check.
 *
 * A generation whose watchers could not be opened re-proves its recorded
 * snapshot from disk on every delivery. The walk may reuse a recorded hash for
 * a file whose proven signature still holds, so a signature recorded inside an
 * unfinished tick would let a sibling delivery replay output computed from
 * bytes a rewrite already replaced.
 */
export async function test_transformttsc_same_tick_rewrite_replaces_the_snapshot_generation(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 4, graphFanout: 4 });
  const modules = projectModules(project.root);
  const pinned = createTickPinnedFilesystem({
    device: fs.lstatSync(project.root, { bigint: true }).dev,
    watch: "refused",
  });
  const cache = createTtscTransformCache(pinned.operations);
  const options = resolveOptions();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const pluginRuns = (): number =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;

  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(pluginRuns(), 1);
  const firstGeneration = [...cache.values()][0];

  // Rewrite one project file and deliver a sibling, so only the walk — not the
  // delivered module's own source comparison — can see the edit.
  fs.writeFileSync(
    path.join(project.root, "src", "mod2.ts"),
    'export const value2: string = "PROBF";\n',
    "utf8",
  );
  assert.ok(await deliver(modules[1]!));
  assert.notEqual(
    [...cache.values()][0],
    firstGeneration,
    "the walk must re-read a project file whose tick never provably ended",
  );
  assert.equal(pluginRuns(), 2);

  // And the out-of-walk half of the same snapshot.
  const externalGeneration = [...cache.values()][0];
  fs.writeFileSync(
    path.join(project.root, "node_modules", "dep0", "index.d.ts"),
    "export declare const dep0: string;\n",
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.notEqual(
    [...cache.values()][0],
    externalGeneration,
    "the out-of-walk re-check must re-read an unseparated external input",
  );
  assert.equal(pluginRuns(), 3);
}
