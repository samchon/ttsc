import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createUtilityPluginProject } from "./createUtilityPluginProject";

/** Assert an evaluation-time directory-link retarget cannot bless stale output. */
export async function assertPersistentUtilityConfigLinkRetargetInvalidatesTransform() {
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
