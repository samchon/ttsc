import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { declareTtscTransformPolling } from "../../../../../packages/unplugin/lib/core/transform/cache/declareTtscTransformPolling.mjs";
import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a persistent cache whose host declared polling never takes watcher
 * silence as proof (samchon/ttsc#1395).
 *
 * WSL2 drive mounts, Docker Desktop bind mounts, and network shares accept a
 * native watch and then report nothing. A generation there trusted its silent
 * watchers, so a source added to the project was never seen, even when the host
 * itself was polling and had seen it. A polling declaration, either the
 * environment's or the host's own through the cache, now keeps every watcher
 * off the generation, and each delivery re-proves its inputs from the recorded
 * snapshot.
 *
 * 1. Compile through a cache whose watches are accepted and stay silent, once with
 *    `CHOKIDAR_USEPOLLING=true` and once with the cache declared polling.
 * 2. Assert the generation holds no watcher, add a project source, and assert the
 *    next delivery recompiles.
 * 3. Compile once more without a declaration and assert the silent watchers are
 *    attached, the bounded default.
 */
export async function test_transformttsc_declared_polling_never_trusts_watcher_silence(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const options = resolveOptions();
  const prior = process.env.CHOKIDAR_USEPOLLING;

  const compile = async (declare: "environment" | "cache" | "none") => {
    const project = createCacheProject({ fileCount: 3, graphFanout: 3 });
    const modules = projectModules(project.root);
    const cache = createTtscTransformCache({
      // Accepted and never heard from, as on a 9P or network mount.
      watch: () => ({ close: () => undefined }),
    });
    if (declare === "environment") process.env.CHOKIDAR_USEPOLLING = "true";
    else delete process.env.CHOKIDAR_USEPOLLING;
    if (declare === "cache") declareTtscTransformPolling(cache, true);
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
    assert.equal(pluginRuns(), 1, `${declare}: one generation serves all`);
    const generation = await [...cache.values()][0]!;
    return { deliver, generation, modules, pluginRuns, project };
  };

  try {
    for (const declare of ["environment", "cache"] as const) {
      const { deliver, generation, modules, pluginRuns, project } =
        await compile(declare);
      assert.equal(
        generation.projectMutationTracker,
        undefined,
        `${declare}: a polling host keeps no project watcher`,
      );
      assert.equal(
        generation.hostInputMutationTracker,
        undefined,
        `${declare}: a polling host keeps no input watcher`,
      );
      fs.writeFileSync(
        path.join(project.root, "src", "added.d.ts"),
        "declare const added: string;\n",
        "utf8",
      );
      assert.ok(await deliver(modules[0]!));
      assert.equal(
        pluginRuns(),
        2,
        `${declare}: a source no watcher reported must still recompile`,
      );
    }

    const { generation } = await compile("none");
    assert.notEqual(
      generation.projectMutationTracker,
      undefined,
      "without a declaration the generation keeps its watchers",
    );
  } finally {
    if (prior === undefined) delete process.env.CHOKIDAR_USEPOLLING;
    else process.env.CHOKIDAR_USEPOLLING = prior;
  }
}
