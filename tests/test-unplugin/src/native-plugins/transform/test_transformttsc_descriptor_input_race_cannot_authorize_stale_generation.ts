import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

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
