import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { cacheEntry } from "../../internal/transform-external/cacheEntry";
import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";

/**
 * Verifies invalidation flows through a reference-graph edge alone.
 *
 * The plugin never reads the external file; only the host graph names it. A
 * content edit is then observable purely as a replaced generation, which proves
 * the graph edge by itself is enough to invalidate.
 *
 * 1. Transform an entry whose graph edges to an external declaration.
 * 2. Change the external declaration.
 * 3. Transform again and assert the generation was replaced.
 *
 * @evidence contracts/testing.md#behavioral-verification Editing a graph-only external declaration replaces the cached generation even though the plugin never reads it.
 * @evidence contracts/testing.md#independent-expectations The authored edge and first-to-second declaration bytes define membership and change; generation inequality is the observable oracle.
 * @evidence contracts/testing.md#distinguishing-cases Graph-reported dependency alone suffices; this case does not claim output text depends on the declaration.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_invalidates_project_cache_through_an_external_graph_edge in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Editing a graph-only external declaration replaces the cached generation even though the plugin never reads it. These assertions remain in test_transformttsc_invalidates_project_cache_through_an_external_graph_edge, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_invalidates_project_cache_through_an_external_graph_edge(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const shared = TestProject.tmpdir("ttsc-unplugin-external-");
  const external = path.join(shared, "types.d.ts");
  fs.writeFileSync(external, "declare const first: string;\n", "utf8");
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const relative = path.relative(root, external).split(path.sep).join("/");
  const options = resolveOptions({
    plugins: emitGraphPlugins({ edges: { "src/main.ts": [relative] } }),
  });
  const cache = createTtscTransformCache();

  const before = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(before);
  const generation = cacheEntry(cache);

  fs.writeFileSync(external, "declare const second: string;\n", "utf8");
  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.notStrictEqual(cacheEntry(cache), generation);
}
