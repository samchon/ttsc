import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies the Farm adapter hands every input under Farm's configured root,
 * whichever spelling Farm's resolver delivered the module under
 * (samchon/ttsc#1462).
 *
 * A host is handed its inputs under the spelling of the module it delivered
 * (samchon/ttsc#1451). Farm resolves a module physically, through a junction or
 * link, while it relates every watch file to its configured root, so under a
 * linked root the input it was handed was no dependency its watcher could
 * relate, and an edit to it rebuilt nothing; measured on the host matrix on
 * Windows. A host whose channel is rooted says so, and the delivery is spelled
 * under that root.
 *
 * 1. Resolve Farm's config on a link to a real project, and deliver a module by
 *    its physical path through a watching Farm context.
 * 2. Assert every input below the project is spelled under the link, none under
 *    the physical directory, and the selected config is handed once.
 */
export async function test_farm_is_handed_a_linked_projects_inputs_under_its_root(): Promise<void> {
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
  const under = (root: string) => (input: string) =>
    input === root || input.startsWith(`${root}${path.sep}`);
  assert.ok(handed.some(under(linked)), "inputs are handed under the root");
  assert.deepEqual(
    handed.filter(under(physical)),
    [],
    "no input is spelled under the physical directory",
  );
  assert.deepEqual(
    handed.filter((input) => input === path.join(linked, "tsconfig.json")),
    [path.join(linked, "tsconfig.json")],
    "the selected config is handed once",
  );
}
