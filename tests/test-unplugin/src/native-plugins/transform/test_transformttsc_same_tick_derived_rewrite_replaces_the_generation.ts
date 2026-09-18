import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PINNED_TICK } from "../../internal/transform-project-cache/PINNED_TICK";
import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { createTickPinnedFilesystem } from "../../internal/transform-project-cache/createTickPinnedFilesystem";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a same-tick, same-length rewrite of a derived input still replaces
 * the generation on the narrow path.
 *
 * With every stamp pinned to one tick, no signature may be recorded: the clock
 * never provably leaves the tick, so a later write is not guaranteed to move
 * any stamp. A recorded signature would make the rewrite invisible, while the
 * retained content comparison must see it.
 *
 * 1. Compile through a filesystem whose stamps are pinned to one tick, and assert
 *    steady deliveries do not recompile.
 * 2. Rewrite a global declaration in place with the same length.
 * 3. Assert the next delivery replaces the generation with one recompile.
 */
export async function test_transformttsc_same_tick_derived_rewrite_replaces_the_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 4,
    graphFanout: 4,
    graphGlobals: 4,
  });
  const modules = projectModules(project.root);
  const pinned = createTickPinnedFilesystem({
    device: fs.lstatSync(project.root, { bigint: true }).dev,
    watch: "silent",
  });
  // One preserved future modification time must not forge clock progress for
  // the otherwise same-tick tree. The change time remains in the real pinned
  // tick, matching an archive or copy that assigned only `mtime`.
  pinned.modificationStamps.set(
    path.join(project.root, "package.json"),
    PINNED_TICK + 1n,
  );
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
  const steadyGeneration = [...cache.values()][0];

  // Unchanged content keeps the generation even though nothing is proven by
  // metadata: declining a signature costs reads, never the cache.
  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(pluginRuns(), 1, "a steady same-tick tree must not recompile");
  assert.equal([...cache.values()][0], steadyGeneration);

  // The rewrite the metadata signature cannot see: same length, same tick.
  const touched = path.join(
    project.root,
    "node_modules",
    "global0",
    "index.d.ts",
  );
  fs.writeFileSync(touched, "declare const ambient0: string;\n", "utf8");
  assert.ok(await deliver(modules[1]!));
  assert.notEqual(
    [...cache.values()][0],
    steadyGeneration,
    "a same-tick rewrite of a derived input must replace the generation",
  );
  assert.equal(
    pluginRuns(),
    2,
    "the retained content comparison must force one recompile",
  );
}
