import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { fallbackToolDirectory } from "../../../../../packages/unplugin/lib/core/bridge/fallbackToolDirectory.js";
import { hostToolDirectory } from "../../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.js";
import { projectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies a project record the adapter cannot write for a new generation gives
 * way to the fallback the host accepts, and that the next delivery of that
 * generation writes it again once it can (samchon/ttsc#1480).
 *
 * A module handed over without the record depends on its own bytes alone, and a
 * host's persistent cache restores it on those whatever its types did. The
 * adapter used to hand nothing over when a write failed, on the reasoning that
 * the host would run the module again at its next start, which a persistent
 * cache does not. A record the adapter cannot write cannot move either, so the
 * module is handed the record in the fallback below the user's temporary
 * directory, which holds the new state; a host with no fallback is handed the
 * old record all the same
 * (`test_transformttsc_hands_a_fallback_record_or_refuses_a_watching_delivery`).
 *
 * 1. Deliver a module through a one-shot Rollup context, which writes the record
 *    and hands it over.
 * 2. Make the record read-only, edit a declaration the project reads, and deliver
 *    the module in a new pass: assert the record kept its bytes, since the
 *    write failed, and the module was handed the fallback's record, written.
 * 3. Make the record writable and deliver another module of that generation:
 *    assert it hands the record over and writes the generation's state.
 */
export async function test_a_record_that_cannot_be_written_gives_way_to_the_fallback(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const root = fs.realpathSync.native(fixture.root);
  const at = (file: string) =>
    path.join(root, path.relative(fixture.root, file));
  const first = at(fixture.modules[0]!);
  const second = at(fixture.modules[1]!);
  const options = { project: path.join(root, "tsconfig.json") };
  const record = projectRecordFile(
    hostToolDirectory(process.cwd()),
    options.project,
  );
  const factory = await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const plugin: any = [factory(options)]
    .flat()
    .find((entry: any) => entry?.name === "ttsc-unplugin");
  const invoke = (hook: any, context: object, ...args: unknown[]): unknown =>
    typeof hook === "function"
      ? hook.apply(context, args)
      : hook?.handler?.apply(context, args);
  const deliver = async (module: string): Promise<string[]> => {
    const handed: string[] = [];
    const context = {
      addWatchFile: (file: string) => handed.push(path.resolve(file)),
      meta: {},
    };
    assert.ok(
      await invoke(
        plugin.transform,
        context,
        fs.readFileSync(module, "utf8"),
        module,
      ),
    );
    return handed;
  };

  await invoke(plugin.buildStart, {});
  assert.deepEqual(await deliver(first), [record], "the record is handed over");
  const before = fs.readFileSync(record);

  // Read-only before the pass starts, so the start's own proof cannot move it
  // either, and the bytes say whether the delivery's write landed.
  fs.chmodSync(record, 0o444);
  try {
    fs.appendFileSync(at(fixture.declaration), "// edited\n");
    await invoke(plugin.buildStart, {});
    const handed = await deliver(first);
    assert.deepEqual(
      fs.readFileSync(record),
      before,
      "the write failed, as this scenario needs",
    );
    const fallback = projectRecordFile(
      fallbackToolDirectory(process.cwd())!,
      options.project,
    );
    assert.deepEqual(handed, [fallback], "the fallback's record instead");
    assert.notDeepEqual(
      fs.readFileSync(fallback),
      before,
      "holding the new generation's state",
    );
  } finally {
    fs.chmodSync(record, 0o644);
  }

  assert.deepEqual(
    await deliver(second),
    [record],
    "the next delivery hands it over",
  );
  assert.notDeepEqual(
    fs.readFileSync(record),
    before,
    "and writes the generation's state",
  );
}
