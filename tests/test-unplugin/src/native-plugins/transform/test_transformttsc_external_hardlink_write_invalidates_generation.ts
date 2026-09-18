import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a project input with a hard link outside the project never inherits
 * watcher authority.
 *
 * Directory notification backends report the path used for a write. Writing
 * through a link outside the project mutates the same inode without an event
 * below the watched root, and Windows does not notify a watcher opened on the
 * original file either. The generation must keep this input on metadata
 * validation, so a sibling delivery cannot replay stale output.
 *
 * 1. Hard-link a project module to a path outside the project and deliver the
 *    entry.
 * 2. Write new content through the external link.
 * 3. Deliver a sibling and assert exactly one whole-project recompile.
 */
export async function test_transformttsc_external_hardlink_write_invalidates_generation(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const modules = projectModules(project.root);
  const linkedInput = modules[1]!;
  const alias = path.join(
    TestProject.tmpdir("ttsc-unplugin-cache-hardlink-"),
    "mod1-alias.ts",
  );
  fs.linkSync(linkedInput, alias);
  const cache = createTtscTransformCache();
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

  assert.ok(await deliver(modules[0]!));
  assert.equal(pluginRuns(), 1);
  const firstGeneration = [...cache.values()][0];

  fs.writeFileSync(alias, 'export const value1: string = "OTHER";\n', "utf8");
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    pluginRuns(),
    2,
    "an external hardlink write must force one whole-project recompile",
  );
  assert.notEqual(
    [...cache.values()][0],
    firstGeneration,
    "the generation must not trust a silent project watcher for a hardlink",
  );
}
