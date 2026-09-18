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
 * Verifies the same-byte link retarget is rejected with notifications unusable.
 *
 * `assertPersistentUtilityConfigLinkRetargetInvalidatesTransform` closes the
 * exact-input watcher, which leaves the generation on the narrow path and
 * proves that path's metadata manifest. A watcher that _failed_ takes the other
 * branch: validation falls back to the complete snapshot, whose out-of-walk
 * comparison records realpaths for graph members only. A universal host input
 * is not a graph member, so a retarget to a byte-identical file would be
 * invisible there unless the fallback proves the universal manifest too.
 */
export async function test_transformttsc_unnotified_utility_config_link_retarget_invalidates_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    plugin: "banner",
    pluginEntry: { configFile: "./config/banner.config.cjs" },
    source: 'export const value: string = "kept";\n',
  });
  const configDirectory = path.join(root, "config");
  const selectionRoot = TestProject.tmpdir("ttsc-banner-unnotified-link-");
  const oldTarget = path.join(selectionRoot, "old-selection");
  const newTarget = path.join(selectionRoot, "new-selection");
  const link = path.join(selectionRoot, "selection-link");
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.mkdirSync(oldTarget, { recursive: true });
  fs.mkdirSync(newTarget, { recursive: true });
  // Byte-identical selections: only the physical identity of the selected file
  // differs, so a content comparison alone cannot see the retarget.
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
      `const selected = require(${JSON.stringify(path.join(link, "selection.cjs"))});`,
      "module.exports = () => selected;",
      "",
    ].join("\n"),
    "utf8",
  );

  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const failures: (() => void)[] = [];
  const cache = createTtscTransformCache({
    watch: (_directory: string, _listener: unknown, onError: () => void) => {
      failures.push(onError);
      return { close: () => undefined };
    },
  });
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /OLD LINK TARGET/);
  const firstGeneration = [...cache.values()][0];
  assert.equal(
    (await firstGeneration!).projectSnapshotComplete,
    true,
    "an unprovable generation would recompile for the wrong reason below",
  );

  // Every watcher stops reporting, so validation can only use recorded state.
  assert.ok(failures.length > 0, "the seam must have registered a watcher");
  for (const fail of failures) {
    fail();
  }
  fs.rmSync(link, { force: true, recursive: true });
  fs.symlinkSync(
    newTarget,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.notEqual(
    [...cache.values()][0],
    firstGeneration,
    "a same-byte retarget of a universal host input must replace the generation",
  );
  assert.match(second.code, /NEW LINK TARGET/);
  assert.doesNotMatch(second.code, /OLD LINK TARGET/);
}
