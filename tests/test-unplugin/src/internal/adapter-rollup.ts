import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject, projectModules } from "./transform-project-cache";

const { rollup } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("rollup");

/**
 * Asserts that running a real rollup build with the unplugin rollup adapter
 * produces plugin-transformed output.
 *
 * Generates in-memory ESM output, collects all chunk code via the shared
 * helper, and checks for the expected plugin marker. Always closes the bundle
 * to release file watchers.
 */
async function assertRollupAdapterTransformsSource() {
  const unpluginRollup =
    await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const root = TestUnpluginProject.createProject();
  const bundle = await rollup({
    input: TestUnpluginProject.mainFile(root),
    plugins: [unpluginRollup()],
  });
  try {
    const generated = await bundle.generate({ format: "esm" });
    TestUnpluginProject.assertTransformedToPlugin(
      TestUnpluginProject.collectRollupOutputCode(generated.output),
    );
  } finally {
    await bundle.close();
  }
}

export {
  assertRollupAdapterTransformsSource,
  assertRollupDisposesAtTheRightBoundary,
};

/**
 * Asserts the Rollup adapter disposes its generation at the right boundary.
 *
 * The Rollup and Rolldown blocks carry both halves of the same rule the Vite
 * block does, and the gate between them is load-bearing: `buildEnd` disposes
 * only for a one-shot build, because Rollup's watcher repeats a build phase and
 * disposing on that repeat is samchon/ttsc#1301. `this.meta.watchMode` is what
 * separates them, so it is exercised in both positions rather than assumed.
 */
async function assertRollupDisposesAtTheRightBoundary(): Promise<void> {
  const unpluginRollup =
    await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const plugin: any = [unpluginRollup()]
    .flat()
    .find((entry: any) => entry?.name === "ttsc-unplugin");
  assert.ok(plugin, "the rollup adapter must expose the ttsc plugin object");
  const project = createCacheProject({ fileCount: 2 });
  const modules = projectModules(project.root);
  const compiles = () =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;
  const invoke = (hook: any, context: object, ...args: unknown[]): unknown =>
    typeof hook === "function"
      ? hook.apply(context, args)
      : hook?.handler?.apply(context, args);
  const deliver = (file: string) =>
    invoke(
      plugin.transform,
      { addWatchFile: () => undefined },
      fs.readFileSync(file, "utf8"),
      file,
    );

  await invoke(plugin.buildStart, {});
  assert.ok(await deliver(modules[0]!));
  assert.equal(compiles(), 1);

  // A watching session must not dispose at the end of a build phase.
  await invoke(plugin.buildEnd, { meta: { watchMode: true } });
  await invoke(plugin.buildStart, {});
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    compiles(),
    1,
    "a watching Rollup rebuild must reuse the generation",
  );

  // Its teardown must.
  await invoke(plugin.closeWatcher, {});
  await invoke(plugin.buildStart, {});
  assert.ok(await deliver(modules[0]!));
  assert.equal(compiles(), 2, "closeWatcher must dispose the generation");

  // A one-shot build has no closeWatcher, so its build phase ending is the
  // boundary instead.
  await invoke(plugin.buildEnd, { meta: { watchMode: false } });
  await invoke(plugin.buildStart, {});
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    compiles(),
    3,
    "a one-shot Rollup build must dispose at buildEnd",
  );
  await invoke(plugin.closeWatcher, {});
}
