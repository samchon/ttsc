import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { hostToolDirectory } from "../../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.js";
import { projectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies the Farm adapter hands Farm the project's record alone, whichever
 * spelling Farm's resolver delivered the module under (samchon/ttsc#1462).
 *
 * Farm resolves a module physically, through a junction or link, while it
 * relates every watch file to its configured root, so an input handed under the
 * physical spelling of a linked root was no dependency its watcher could
 * relate, and an edit to it rebuilt nothing; measured on the host matrix on
 * Windows. No input reaches Farm any more: the record is one absolute path
 * below the tool directory of Farm's own root, the same for every spelling of
 * the project, and the adapter's bridge moves it for every input, under
 * whichever spelling the compiler read it. It lies below Farm's root rather
 * than the directory Farm runs in, since Farm cannot relate a watch file on
 * another drive to its root.
 *
 * 1. Resolve Farm's config on a link to a real project, and deliver a module by
 *    its physical path through a watching Farm context.
 * 2. Assert Farm is handed the record and nothing else, below the tool directory
 *    of the root Farm was configured with, and that the record names the
 *    selected config.
 */
export async function test_farm_is_handed_the_project_record_alone(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const physical = fs.realpathSync.native(fixture.root);
  const linked = path.join(
    path.dirname(physical),
    `${path.basename(physical)}-link`,
  );
  fs.symlinkSync(
    physical,
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  const module = path.join(
    physical,
    path.relative(fixture.root, fixture.modules[0]!),
  );
  const source = fs.readFileSync(module, "utf8");
  const factory = await TestUnpluginRuntime.loadUnpluginAdapter("farm");
  const plugin: any = [factory({ project: path.join(linked, "tsconfig.json") })]
    .flat()
    .find((entry: any) => entry?.name === "ttsc-unplugin");
  // Farm's own compilation context, as unplugin's Farm plugin wraps it: the
  // adapter's `addWatchFile(file, input)` reaches it.
  const handed: string[] = [];
  const compilation = {
    addWatchFile: (_file: string, input: string) => handed.push(input),
    error: (error: unknown) => assert.fail(String(error)),
    getWatchFiles: () => handed,
    warn: () => undefined,
  };
  plugin.configResolved({ compilation: { mode: "development" }, root: linked });
  await plugin.buildStart.executor(undefined, compilation);
  assert.ok(
    await plugin.transform.executor(
      { content: source, moduleType: "ts", query: [], resolvedPath: module },
      compilation,
    ),
  );
  assert.equal(
    handed.length,
    1,
    `Farm is handed the record alone: ${JSON.stringify(handed)}`,
  );
  const record = handed[0]!;
  assert.equal(
    record,
    projectRecordFile(
      hostToolDirectory(linked),
      path.join(linked, "tsconfig.json"),
    ),
    "the project's record, below Farm's root",
  );
  assert.ok(path.isAbsolute(record), "as one absolute path");
  const written = readProjectRecordFile(record);
  assert.ok(written !== undefined, "the record is written");
  assert.equal(written.tsconfig, path.join(linked, "tsconfig.json"));
  assert.ok(
    Object.keys(written.inputs).some(
      (input) => path.basename(input) === "tsconfig.json",
    ),
    "the record names the selected config",
  );
}
