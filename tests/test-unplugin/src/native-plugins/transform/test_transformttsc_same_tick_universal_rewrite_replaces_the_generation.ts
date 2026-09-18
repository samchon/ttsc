import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { createTickPinnedFilesystem } from "../../internal/transform-project-cache/createTickPinnedFilesystem";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a same-tick, same-length rewrite of a universal input still replaces
 * the generation.
 *
 * The universal inputs, `tsconfig.json`, plugin descriptors, and package
 * manifests, are the ones tooling rewrites in place. A capture-time signature
 * for a stamp whose tick the clock has not provably left would let such a
 * rewrite replay stale output.
 *
 * 1. Compile through a tick-pinned filesystem with silent watches.
 * 2. Rewrite a universal input in place with the same length.
 * 3. Assert the next delivery replaces the generation.
 */
export async function test_transformttsc_same_tick_universal_rewrite_replaces_the_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 4, graphFanout: 4 });
  const modules = projectModules(project.root);
  const pinned = createTickPinnedFilesystem({
    device: fs.lstatSync(project.root, { bigint: true }).dev,
    watch: "silent",
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

  // Same bytes reordered: the length, and with the pinned tick every stamp,
  // survive the rewrite untouched.
  fs.writeFileSync(
    path.join(project.root, "package.json"),
    JSON.stringify({ type: "commonjs", private: true }, null, 2),
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.notEqual(
    [...cache.values()][0],
    firstGeneration,
    "a same-tick rewrite of a universal input must replace the generation",
  );
  assert.equal(pluginRuns(), 2);
}
