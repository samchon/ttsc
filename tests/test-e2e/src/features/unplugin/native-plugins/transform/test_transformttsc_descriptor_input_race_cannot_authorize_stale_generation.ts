import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";

/**
 * Verifies a module candidate that appears after descriptor resolution cannot
 * bless the earlier descriptor result.
 *
 * A plugin descriptor can resolve its source through Node's module resolution,
 * which prefers `.js` over `.json`. If the `.js` candidate appears after the
 * descriptor was resolved, pairing the earlier result with the later filesystem
 * state would authorize a generation built from a descriptor that no longer
 * resolves that way.
 *
 * 1. Create a descriptor that requires an extensionless selection resolving to a
 *    `.json` file.
 * 2. Have the descriptor create the superseding `.js` candidate when the first
 *    delivery evaluates it.
 * 3. Assert the first delivery stabilizes the change, and the settled generation
 *    stays reusable.
 *
 * @evidence contracts/testing.md#behavioral-verification Descriptor evaluation creates a superseding JS candidate, first delivery compiles twice, and the settled generation is reused.
 * @evidence contracts/testing.md#independent-expectations Authored extensionless require initially selects JSON and the descriptor plants higher-priority JS; direct existence and run-log counts witness the transition.
 * @evidence contracts/testing.md#distinguishing-cases Candidate appears during first descriptor evaluation without changing selected source bytes, requiring identity stabilization rather than output-only comparison.
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_descriptor_input_race_cannot_authorize_stale_generation owns native descriptor resolution across a newly created preferred JS candidate and stable replay. Evidence selection does not establish runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Descriptor evaluation creates a superseding JS candidate, first delivery compiles twice, and the settled generation is reused. These assertions remain in test_transformttsc_descriptor_input_race_cannot_authorize_stale_generation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_descriptor_input_race_cannot_authorize_stale_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 1,
    graphFanout: 1,
    isolatedPluginSource: true,
  });
  const external = TestProject.tmpdir("ttsc-unplugin-descriptor-race-");
  // The selection's own package scope. Without one, the scope Node reads for
  // `selection.js` is the shared temporary directory's, whose absent
  // `package.json` is proven by that directory's metadata, which every other
  // process writing there moves; the proof then fails for a reason this
  // scenario is not about.
  fs.writeFileSync(
    path.join(external, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }),
    "utf8",
  );
  const selectionBase = path.join(external, "selection");
  const selectionJson = `${selectionBase}.json`;
  const selectionJs = `${selectionBase}.js`;
  fs.writeFileSync(
    selectionJson,
    JSON.stringify(path.join(project.root, "go-plugin")),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project.root, "plugin.cjs"),
    [
      'const fs = require("node:fs");',
      `const source = require(${JSON.stringify(selectionBase)});`,
      "module.exports = () => {",
      `  if (!fs.existsSync(${JSON.stringify(selectionJs)})) fs.writeFileSync(${JSON.stringify(selectionJs)}, ${JSON.stringify(`module.exports = ${JSON.stringify(path.join(project.root, "go-plugin"))};\n`)}, "utf8");`,
      '  return { name: "descriptor-race", source };',
      "};",
      "",
    ].join("\n"),
    "utf8",
  );

  const cache = createTtscTransformCache();
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const source = fs.readFileSync(main, "utf8");
  assert.ok(await transformTtsc(main, source, options, undefined, cache));
  assert.ok(fs.existsSync(selectionJs));
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "descriptor appearance must stabilize inside the first delivery",
  );
  const stableGeneration = [...cache.values()][0];

  assert.ok(await transformTtsc(main, source, options, undefined, cache));
  assert.equal(
    [...cache.values()][0],
    stableGeneration,
    "the settled descriptor generation must remain reusable",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
