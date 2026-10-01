import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { declareTtscTransformPolling } from "../../../../../../packages/unplugin/lib/core/transform/cache/declareTtscTransformPolling.mjs";
import { createCacheProject } from "../../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../internal/transform-project-cache/projectModules";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Environment- and cache-declared polling attach neither tracker, notice added source with a second compile, while undeclared control retains trackers.
 * @evidence contracts/testing.md#independent-expectations Accepted silent watch handles simulate notification absence; literal polling channels and native invocation counts independently establish the fallback decision.
 * @evidence contracts/testing.md#distinguishing-cases Environment true, cache true and no declaration contrast; source appearance must remain visible despite silence.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_declared_polling_never_trusts_watcher_silence in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup. Ambient environment changes are restored by the existing finally block.
 * @evidence contracts/e2e.md#preserved-coverage Environment- and cache-declared polling attach neither tracker, notice added source with a second compile, while undeclared control retains trackers. These assertions remain in test_transformttsc_declared_polling_never_trusts_watcher_silence, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
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
