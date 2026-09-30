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
 *
 * @evidence contracts/testing.md#behavioral-verification Watching buildEnd preserves one compile, closeWatcher forces two, and one-shot buildEnd forces three.
 * @evidence contracts/testing.md#independent-expectations Native run-log count exposes retention/disposal independent of identical transformed output.
 * @evidence contracts/testing.md#distinguishing-cases Watch phase end versus watcher teardown versus one-shot phase end.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_rollup_disposes_at_the_right_boundary is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built Rollup hooks and real native generation execute with explicitly supplied watchMode, not live watch dispatch.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: watching buildEnd preserves one compile, closeWatcher forces two, and one-shot buildEnd forces three. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
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
