import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Writing a project source through an outside hard link replaces the generation and causes exactly one additional compile.
 * @evidence contracts/testing.md#independent-expectations The actual hard link shares native inode content and the independent native run log counts the fresh invocation.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged first generation versus outside-alias write distinguishes metadata validation from watcher silence.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_external_hardlink_write_invalidates_generation in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Writing a project source through an outside hard link replaces the generation and causes exactly one additional compile. These assertions remain in test_transformttsc_external_hardlink_write_invalidates_generation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_external_hardlink_write_invalidates_generation(): Promise<void> {
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
