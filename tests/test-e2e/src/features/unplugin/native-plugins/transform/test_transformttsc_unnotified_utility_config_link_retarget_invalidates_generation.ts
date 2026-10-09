import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createUtilityPluginProject } from "../../../../internal/unplugin/internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies a same-content link retarget is still caught when notifications are
 * unusable.
 *
 * `test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation`
 * closes the exact-input watcher, which keeps the generation on the narrow
 * path. A watcher that failed takes the other branch: validation falls back to
 * the complete snapshot, whose out-of-walk comparison records realpaths for
 * graph members only. A universal host input is not a graph member, so a
 * retarget to a directory holding a byte-identical module would be invisible
 * unless the fallback proves the universal manifest too.
 *
 * 1. Configure a banner whose config requires a module through a directory link,
 *    and compile through a cache whose watchers can be failed.
 * 2. Fail the watchers.
 * 3. Retarget the link to a directory whose `selection.cjs` is byte-identical, and
 *    assert the next delivery replaces the generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Complete generation outputs OLD LINK TARGET; failed watchers plus byte-identical selection-link retarget replace generation and output only NEW LINK TARGET.
 * @evidence contracts/testing.md#independent-expectations Selection text identical while physical target and nested value differ, fixing independent identity/output oracle.
 * @evidence contracts/testing.md#distinguishing-cases Universal host input outside graph under unusable notifications, same-byte link retarget.
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_unnotified_utility_config_link_retarget_invalidates_generation owns a CJS banner's initial evaluation and same-byte external link retarget after watcher failure. Evidence selection does not establish runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary Actual CJS banner config evaluation and native envelope production exercise the failed-watcher fallback across a physical selection-link retarget. A synthetic envelope cannot establish which target the config loader evaluated or that its changed value reaches delivery.
 * @evidence contracts/e2e.md#shared-execution One banner CJS fixture and transform cache serve the initial evaluation and the delivery after watcher failure and link retarget. The changed physical selection requires another native generation; both deliveries retain the same consumer and plugin identity.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Complete generation outputs OLD LINK TARGET; failed watchers plus byte-identical selection-link retarget replace generation and output only NEW LINK TARGET. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
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
  // A package scope of its own: without it, the selection's scope lookup reads
  // the shared temporary directory's missing manifest, a real input any other
  // process writing there moves.
  fs.writeFileSync(
    path.join(selectionRoot, "package.json"),
    '{ "private": true }\n',
    "utf8",
  );
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
