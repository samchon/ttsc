import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies the Rollup adapter disposes its generation at the right boundary.
 *
 * `buildEnd` disposes only for a one-shot build, because Rollup's watcher
 * repeats a build phase and disposing on that repeat is samchon/ttsc#1301.
 * `this.meta.watchMode` is what separates them, so it is exercised in both
 * positions rather than assumed.
 *
 * 1. Deliver a module in a first build and assert one compile.
 * 2. End a watching build, start another, and assert the generation is reused,
 *    then fire `closeWatcher` and assert it is disposed.
 * 3. End a one-shot build and assert the next build compiles again.
 */
export async function test_rollup_disposes_at_the_right_boundary(): Promise<void> {
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
