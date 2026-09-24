import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { waitFor } from "../../internal/adapter-vite-serve/waitFor";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies the Rollup adapter refuses Rollup's cache for every module while the
 * bridge has moved the project's record since a delivery last registered it,
 * and accepts the cache again once a delivery has (samchon/ttsc#1460).
 *
 * Rollup applies a record move it hears during a build to the cache that build
 * started from, and the build's own result then replaces that cache with the
 * modules intact, so the rerun served them from its cache and they stayed on
 * their old output. Rollup asks `shouldTransformCachedModule` before serving a
 * module from its cache; the adapter answers for the bridge, which knows
 * whether it signalled the project and whether a delivery registered since.
 *
 * A registration must not answer the signal with a stale delivery either. A
 * pass proves the generation once and serves every later module from it, so a
 * module first delivered after the edit, in the same pass, carries the state
 * before it; its registration proves its inputs against changes since the pass
 * opened, not since its own transform, and is signalled again at once.
 *
 * 1. Deliver a module through a watching Rollup context and assert Rollup may
 *    serve it from its cache.
 * 2. Edit a declaration the module read, wait for the record to be moved, and
 *    assert Rollup must transform every module instead, since a module names no
 *    project of its own.
 * 3. Deliver a second module in the same pass, and assert Rollup must transform it
 *    too, since the pass served it the state before the edit.
 * 4. Open a new pass and deliver a module, and assert Rollup must still transform
 *    the other in that pass and every module in the next; deliver them, open
 *    the pass after, and assert Rollup may serve each from its cache, then
 *    close the watcher.
 */
export async function test_rollup_transforms_a_cached_module_the_bridge_still_owes(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const root = fs.realpathSync.native(fixture.root);
  const at = (file: string) =>
    path.join(root, path.relative(fixture.root, file));
  const module = at(fixture.modules[0]!);
  const source = fs.readFileSync(module, "utf8");
  const second = at(fixture.modules[1]!);
  const secondSource = fs.readFileSync(second, "utf8");
  const declaration = at(fixture.declaration);
  const options = { project: path.join(root, "tsconfig.json") };
  const factory = await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const plugin: any = [factory(options)]
    .flat()
    .find((entry: any) => entry?.name === "ttsc-unplugin");
  const invoke = (hook: any, context: object, ...args: unknown[]): unknown =>
    typeof hook === "function"
      ? hook.apply(context, args)
      : hook?.handler?.apply(context, args);
  const records: string[] = [];
  const context = {
    addWatchFile: (file: string) => records.push(file),
    meta: { rollupVersion: "4", watchMode: true },
  };
  // What Rollup's cache holds of each module: the `meta` its last delivery
  // returned, which Rollup hands back when it asks.
  const metas = new Map<string, unknown>();
  const deliver = async (text: string, id: string) => {
    const result = (await invoke(plugin.transform, context, text, id)) as
      | { meta?: unknown }
      | undefined;
    assert.ok(result);
    metas.set(id, result.meta);
  };
  const cacheable = (id: string = module) =>
    invoke(plugin.shouldTransformCachedModule, context, {
      id,
      meta: metas.get(id),
    });
  try {
    await invoke(plugin.buildStart, {});
    await deliver(source, module);
    assert.equal(records.length, 1, "Rollup watches the project's record");
    assert.equal(
      cacheable(),
      null,
      "a module that ran since any signal may come from Rollup's cache",
    );

    const record = records[0]!;
    const before = fs.readFileSync(record, "utf8");
    fs.appendFileSync(declaration, "export declare const owed: 1;\n");
    await waitFor(
      () => fs.readFileSync(record, "utf8") !== before,
      "the record to be moved for the edited declaration",
    );
    assert.equal(
      cacheable(),
      true,
      "a module signalled since it last ran must be transformed",
    );
    assert.equal(
      cacheable(second),
      true,
      "every module of the project, since a module names no project",
    );

    await deliver(secondSource, second);
    assert.equal(
      cacheable(second),
      true,
      "a module the pass served from before the edit is signalled at once",
    );

    await invoke(plugin.buildStart, {});
    await deliver(source, module);
    assert.equal(
      cacheable(second),
      true,
      "the pass that answered the signal transforms its every module",
    );
    await deliver(secondSource, second);
    await invoke(plugin.buildStart, {});
    assert.equal(
      cacheable(),
      true,
      "the next pass runs every module once more, whatever the first served",
    );
    await deliver(source, module);
    await deliver(secondSource, second);
    await invoke(plugin.buildStart, {});
    assert.equal(
      cacheable(),
      null,
      "the pass after that serves from the cache",
    );
    assert.equal(cacheable(second), null);
  } finally {
    await invoke(plugin.closeWatcher, {});
  }
}
