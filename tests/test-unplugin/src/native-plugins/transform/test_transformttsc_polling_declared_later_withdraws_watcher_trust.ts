import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { declareTtscTransformPolling } from "../../../../../packages/unplugin/lib/core/transform/cache/declareTtscTransformPolling.mjs";
import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a generation captured with native watchers stops trusting their
 * silence once polling is declared for its cache.
 *
 * A polling declaration only kept watchers off generations captured after it.
 * A Vite plugin instance reused across servers, or a build-scoped cache kept
 * into the next session, carried a generation captured while notifications
 * were trusted; after the host declared polling, its accepted but silent
 * watchers still proved a newly added source absent, and the old transform was
 * served (samchon/ttsc#1542). The environment's `CHOKIDAR_USEPOLLING` is the
 * same transition.
 *
 * 1. Compile through a cache whose watches are accepted and stay silent, with no
 *    polling declared, and assert the generation keeps its watchers.
 * 2. Declare polling, through the cache or through the environment.
 * 3. Add a project source and deliver again: the generation holds no watcher and
 *    the delivery recompiles. Deliver once more unchanged: it is reused.
 */
export async function test_transformttsc_polling_declared_later_withdraws_watcher_trust(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const options = resolveOptions();
  const prior = process.env.CHOKIDAR_USEPOLLING;
  delete process.env.CHOKIDAR_USEPOLLING;

  try {
    for (const declare of ["cache", "environment"] as const) {
      const project = createCacheProject({ fileCount: 3, graphFanout: 3 });
      const modules = projectModules(project.root);
      const cache = createTtscTransformCache({
        watch: () => ({ close: () => undefined }),
      });
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
      for (const file of modules) assert.ok(await deliver(file));
      const generation = await [...cache.values()][0]!;
      assert.notEqual(
        generation.projectMutationTracker,
        undefined,
        `${declare}: the native generation keeps its watchers`,
      );

      if (declare === "cache") declareTtscTransformPolling(cache, true);
      else process.env.CHOKIDAR_USEPOLLING = "true";
      fs.writeFileSync(
        path.join(project.root, "src", "added.d.ts"),
        "declare const added: string;\n",
        "utf8",
      );
      assert.ok(await deliver(modules[0]!));
      assert.equal(
        pluginRuns(),
        2,
        `${declare}: a source the silent watchers never reported recompiles`,
      );
      const recompiled = await [...cache.values()][0]!;
      assert.equal(recompiled.projectMutationTracker, undefined);
      assert.ok(await deliver(modules[0]!));
      assert.equal(pluginRuns(), 2, `${declare}: an unchanged project is reused`);
      delete process.env.CHOKIDAR_USEPOLLING;
    }
  } finally {
    if (prior === undefined) delete process.env.CHOKIDAR_USEPOLLING;
    else process.env.CHOKIDAR_USEPOLLING = prior;
  }
}
