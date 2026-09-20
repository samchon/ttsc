import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { waitFor } from "../../internal/adapter-vite-serve/waitFor";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies the Rollup adapter refuses Rollup's cache for a module whose
 * sentinel the bridge rewrote since the module last ran, and accepts it again
 * once the module has run (samchon/ttsc#1460).
 *
 * Rollup applies a sentinel rewrite it hears during a build to the cache that
 * build started from, and the build's own result then replaces that cache with
 * the module intact, so the rerun served the module from its cache and the
 * module stayed on its old output. Rollup asks `shouldTransformCachedModule`
 * before serving a module from its cache; the adapter answers for the bridge,
 * which knows which importers it signalled and which registered since.
 *
 * 1. Deliver a module through a watching Rollup context and assert Rollup may
 *    serve it from its cache.
 * 2. Edit a declaration the module read, wait for the sentinel to be rewritten,
 *    and assert Rollup must transform the module instead.
 * 3. Deliver the module again and assert Rollup may serve it from its cache, then
 *    close the watcher.
 */
export async function test_rollup_transforms_a_cached_module_the_bridge_still_owes(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const root = fs.realpathSync.native(fixture.root);
  const at = (file: string) =>
    path.join(root, path.relative(fixture.root, file));
  const module = at(fixture.modules[0]!);
  const source = fs.readFileSync(module, "utf8");
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
  const sentinels: string[] = [];
  const context = {
    addWatchFile: (file: string) => sentinels.push(file),
    meta: { watchMode: true },
  };
  const cacheable = () =>
    invoke(plugin.shouldTransformCachedModule, context, { id: module });
  try {
    await invoke(plugin.buildStart, {});
    assert.ok(await invoke(plugin.transform, context, source, module));
    assert.equal(sentinels.length, 1, "Rollup watches one sentinel");
    assert.equal(
      cacheable(),
      null,
      "a module that ran since any signal may come from Rollup's cache",
    );

    const sentinel = sentinels[0]!;
    const before = fs.readFileSync(sentinel, "utf8");
    fs.appendFileSync(declaration, "export declare const owed: 1;\n");
    await waitFor(
      () => fs.readFileSync(sentinel, "utf8") !== before,
      "the sentinel to be rewritten for the edited declaration",
    );
    assert.equal(
      cacheable(),
      true,
      "a module signalled since it last ran must be transformed",
    );
    assert.equal(
      invoke(plugin.shouldTransformCachedModule, context, {
        id: at(fixture.modules[1]!),
      }),
      null,
      "a module the bridge never signalled is Rollup's to decide",
    );

    assert.ok(await invoke(plugin.transform, context, source, module));
    assert.equal(
      cacheable(),
      null,
      "the run that registered the module answers the signal",
    );
  } finally {
    await invoke(plugin.closeWatcher, {});
  }
}
