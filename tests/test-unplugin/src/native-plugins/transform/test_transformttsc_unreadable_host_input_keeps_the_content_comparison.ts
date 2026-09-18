import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a universal host input with no readable content never acquires one.
 *
 * Descriptor and config inputs are validated through their own manifest, which
 * skips an entry whose metadata still matches. An input the host could see but
 * not read records a missing state on both sides, so its comparison succeeds
 * while nothing reads it and its metadata never moves. A signature for it would
 * be skipped for the generation's life, and the per-module loop skips the same
 * spelling, so bytes appearing later would never be compared at all.
 *
 * The input is a link with no target, the one shape both the host's own
 * filesystem and the adapter's fail to read for the same reason. Its content
 * then appears through the cache-owned read alone, so no metadata moves and
 * only a retained content comparison can see it.
 */
export async function test_transformttsc_unreadable_host_input_keeps_the_content_comparison(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 4,
    graphFanout: 4,
    unreadableHostInput: true,
  });
  const modules = projectModules(project.root);
  const unreadable = path.join(project.root, "node_modules", "host-input.json");
  let appeared = false;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      if (appeared && path.resolve(location) === unreadable) {
        return Buffer.from("{}\n", "utf8");
      }
      return fs.readFileSync(location);
    },
  });
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
  assert.equal(
    pluginRuns(),
    1,
    "an unreadable universal input matching its recorded state must still hit",
  );

  appeared = true;
  await assert.rejects(
    () => deliver(modules[0]!),
    /after 2 attempts[\s\S]*host\/content-changed[\s\S]*host-input\.json/,
  );
  assert.equal(
    pluginRuns(),
    3,
    "a producer contradiction must terminate after one bounded retry wave",
  );
}
