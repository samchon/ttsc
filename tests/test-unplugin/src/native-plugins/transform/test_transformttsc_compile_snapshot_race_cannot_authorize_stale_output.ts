import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies a project edit between the native compile and the snapshot capture
 * cannot become an authoritative stale generation.
 *
 * The compile reads the old bytes, and the walk that follows sees the new ones.
 * Publishing that pair would serve output that no longer matches its recorded
 * snapshot, so the first delivery has to stabilize the project before it
 * resolves.
 *
 * 1. Rewrite a sibling module while the post-compile walk lists its directory.
 * 2. Deliver the entry and assert the first delivery stabilized the raced project.
 * 3. Deliver the sibling and assert it reuses that stabilized generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Injected postcompile directory enumeration edits a sibling; first delivery stabilizes with two compiles and sibling output contains AFTER from that shared generation.
 * @evidence contracts/testing.md#independent-expectations The filesystem seam performs a literal PROBE-AFTER edit once after the run log appears, and the independent log counts actual attempts.
 * @evidence contracts/testing.md#distinguishing-cases A lasting source edit during capture contrasts with restored ABA inputs; stable sibling must not trigger a third compile.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_compile_snapshot_race_cannot_authorize_stale_output in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Injected postcompile directory enumeration edits a sibling; first delivery stabilizes with two compiles and sibling output contains AFTER from that shared generation. These assertions remain in test_transformttsc_compile_snapshot_race_cannot_authorize_stale_output, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_compile_snapshot_race_cannot_authorize_stale_output(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const lazy = path.join(project.root, "src", "mod1.ts");
  let raced = false;
  const cache = createTtscTransformCache({
    readdir: (location: string) => {
      if (
        !raced &&
        fs.existsSync(project.runLog) &&
        path.resolve(location) === path.dirname(lazy)
      ) {
        raced = true;
        fs.writeFileSync(
          lazy,
          'export const value1: string = "PROBE-AFTER";\n',
          "utf8",
        );
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal(raced, true);
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "the first delivery must stabilize the raced project before resolving",
  );
  const stableGeneration = [...cache.values()][0];

  const result = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.match(result.code, /AFTER/);
  assert.equal([...cache.values()][0], stableGeneration);
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "the sibling must reuse the generation stabilized by the first delivery",
  );
}
