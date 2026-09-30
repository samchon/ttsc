import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies a directory link retargeted while a config is evaluated cannot bless
 * stale output.
 *
 * A banner config that requires its selection through a directory link reads
 * whatever the link points at during evaluation. Retargeting the link during
 * that evaluation leaves the output describing the old target, so watch
 * registration must keep the link's lexical spelling, and the raced output must
 * be discarded both on the first request and after invalidation.
 *
 * 1. Configure a banner whose config requires a module through a directory link
 *    outside the project.
 * 2. Retarget the link during the first evaluation and assert the raced output is
 *    discarded and its stable retry retained, with the link registered under
 *    its lexical spelling.
 * 3. Retarget it again and assert the invalidated generation also discards its
 *    raced old-target output.
 *
 * @evidence contracts/testing.md#behavioral-verification Config evaluation retargets an external link; native output is NEW not OLD, lexical watch/realpath proof survives, stable replay reuses and a later retarget stabilizes anew.
 * @evidence contracts/testing.md#independent-expectations Two target modules have identical selection code but distinct value modules; actual link realpath and forbidden OLD text independently expose stale evaluation.
 * @evidence contracts/testing.md#distinguishing-cases Initial evaluation race, unchanged stable replay and postinvalidation race remain; host-input watcher closes before same-byte identity retarget proof.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The real linked utility plugin reads consumer configuration and produces code, completeness, graph or source-map fields consumed by the built adapter. The asserted selection/output/registration cannot be established by an in-memory config or dependency-list unit alone.
 * @evidence contracts/e2e.md#shared-execution The utility fixture seeds the workspace plugin package and shares the native Go build cache; each distinct plugin/contributor set retains its own content-keyed host artifact. This case reuses its consumer and cache across configuration/content transitions where supplied; changed config options are inputs, not repeated package installations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Config evaluation retargets an external link; native output is NEW not OLD, lexical watch/realpath proof survives, stable replay reuses and a later retarget stabilizes anew. These assertions remain in test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    plugin: "banner",
    pluginEntry: { configFile: "./config/banner.config.cjs" },
    source: 'export const value: string = "kept";\n',
  });
  const configDirectory = path.join(root, "config");
  const selectionRoot = TestProject.tmpdir("ttsc-banner-link-selection-");
  const oldTarget = path.join(selectionRoot, "old-selection");
  const newTarget = path.join(selectionRoot, "new-selection");
  const link = path.join(selectionRoot, "selection-link");
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.mkdirSync(oldTarget, { recursive: true });
  fs.mkdirSync(newTarget, { recursive: true });
  // A package scope of its own: without it, the selection's scope lookup reads
  // the shared temporary directory's missing manifest, a real input any other
  // process writing there moves.
  fs.writeFileSync(
    path.join(selectionRoot, "package.json"),
    '{ "private": true }\n',
    "utf8",
  );
  const selectionSource = 'module.exports = require("./value.cjs");\n';
  fs.writeFileSync(
    path.join(oldTarget, "selection.cjs"),
    selectionSource,
    "utf8",
  );
  fs.writeFileSync(
    path.join(newTarget, "selection.cjs"),
    selectionSource,
    "utf8",
  );
  fs.writeFileSync(
    path.join(oldTarget, "value.cjs"),
    'module.exports = { text: "OLD LINK TARGET" };\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(newTarget, "value.cjs"),
    'module.exports = { text: "NEW LINK TARGET" };\n',
    "utf8",
  );
  fs.symlinkSync(
    oldTarget,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  fs.writeFileSync(
    path.join(configDirectory, "banner.config.cjs"),
    [
      'const fs = require("node:fs");',
      `const selected = require(${JSON.stringify(path.join(link, "selection.cjs"))});`,
      "module.exports = () => {",
      `  if (fs.realpathSync.native(${JSON.stringify(link)}) === ${JSON.stringify(fs.realpathSync.native(oldTarget))}) {`,
      `    fs.rmSync(${JSON.stringify(link)}, { force: true, recursive: true });`,
      `    fs.symlinkSync(${JSON.stringify(newTarget)}, ${JSON.stringify(link)}, ${JSON.stringify(process.platform === "win32" ? "junction" : "dir")});`,
      "  }",
      "  return selected;",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );

  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const cache = createTtscTransformCache();
  const watched: string[] = [];
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
    { addWatchFile: (input: string) => watched.push(input) },
  );
  assert.ok(first);
  assert.match(first.code, /NEW LINK TARGET/);
  assert.doesNotMatch(first.code, /OLD LINK TARGET/);
  assert.ok(
    watched.includes(path.join(link, "selection.cjs")),
    "watch registration must preserve the lexical link spelling",
  );
  const firstGeneration = [...cache.values()][0];

  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.equal(
    [...cache.values()][0],
    firstGeneration,
    "the first request must discard the raced output and retain its stable retry",
  );
  assert.match(second.code, /NEW LINK TARGET/);
  assert.doesNotMatch(second.code, /OLD LINK TARGET/);

  const secondGeneration = firstGeneration!;
  const secondGenerationState = await secondGeneration;
  assert.equal(secondGenerationState.result.type, "success");
  const linkedSelection = path.join(link, "selection.cjs");
  assert.ok(secondGenerationState.result.hostInputs?.includes(linkedSelection));
  assert.equal(
    secondGenerationState.result.hostInputRealpaths?.[linkedSelection],
    fs.realpathSync.native(linkedSelection),
  );
  // Filesystem notifications are advisory. Close the exact-input watcher to
  // prove metadata validation independently rejects a same-byte link retarget.
  secondGenerationState.hostInputMutationTracker?.close();
  fs.rmSync(link, { force: true, recursive: true });
  fs.symlinkSync(
    oldTarget,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  const third = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(third);
  assert.notEqual([...cache.values()][0], secondGeneration);
  assert.match(third.code, /NEW LINK TARGET/);
  assert.doesNotMatch(
    third.code,
    /OLD LINK TARGET/,
    "the invalidated generation must also discard its raced old-target output",
  );
}
