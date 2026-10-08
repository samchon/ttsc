import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies plugin notifications follow actual source bytes and new membership.
 *
 * Explicit notifications exercise the topology's source fingerprints and owned
 * observer registrations. Unchanged bytes and pruned entries must stay quiet; a
 * new directory must register and report the source already inside it.
 *
 * 1. Register one positional source, config and selected plugin tree.
 * 2. Contrast unchanged and pruned notifications with actual source edits.
 * 3. Create a package before its own watch exists, then retain a quiet refresh.
 * 4. Publish provisional module/package roots, then verify narrowing, repeated
 *    publication, a selection switch, removal/recreation and explicit clearing.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual WatchTopology classifies config and plugin changes, suppresses unchanged/pruned notifications and discovers new package files. Provisional module/package publication retains pre-read byte baselines through linked/executable narrowing and repeated publication; a new selection and recreated source remain observable, while [] clears plugin interests. Each topology closes its recorded handles.
 * @evidence contracts/testing.md#independent-expectations Literal authored byte transitions and the declared config/plugin roles establish expected event kinds and paths. Notifications are supplied as stimuli, never as expected topology output.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged root attention, pruned-directory attention, module/source edits and populated newly created directories distinguish attention from keyed source movement. Fresh initial bytes stay quiet. Six independent publication cases contrast retained package versus module baselines, same-root repetition, a new selected root, a removed/recreated package and successful empty selection; loader metadata ordering and actual native delivery belong to maintained Metro/esbuild boundary callers.
 * @evidence contracts/testing.md#execution-ownership The source unit calls actual WatchTopology, source digest and directory adapter operations with explicitly recorded subscriptions. A positional source requires no compiler-list process; no native subscription, installation or build runs here. The retained native watcher E2E population owns actual delivery.
 */
export async function test_watch_plugin_notifications_report_only_keyed_source_changes(): Promise<void> {
  const failures: unknown[] = [];
  for (const [label, run] of [
    ["source notifications", verifySourceNotifications],
    ["source publication handoffs", verifyPublicationHandoffs],
  ] as const) {
    try {
      await run();
    } catch (cause) {
      failures.push(new Error(label, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "plugin notification controls failed");
}

async function verifySourceNotifications(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-plugin-notifications-unit-"),
  );
  const source = path.join(root, "src", "main.ts");
  const config = path.join(root, "tsconfig.json");
  const plugin = path.join(root, "plugin");
  const goMod = path.join(plugin, "go.mod");
  const nested = path.join(plugin, "internal", "mark", "mark.go");
  const fixture = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "test",
    "fixtures",
    "unit",
    "watch_plugin_notifications_report_only_keyed_source_changes",
  );
  TestProject.copyDirectory(path.join(fixture, "inputs-1"), root);
  fs.renameSync(`${nested}.txt`, nested);
  for (const [location, bytes] of [
    [source, "export const value = 1;\n"],
    [config, JSON.stringify({ files: ["src/main.ts"] })],
  ]) {
    fs.mkdirSync(path.dirname(location!), { recursive: true });
    fs.writeFileSync(location!, bytes!);
  }
  const changes: WatchInputChange[] = [];
  const observed = recordWatchers(watchDirectoryThroughFsWatch);
  const topology = new WatchTopology(
    { cwd: root, files: [source], projectRoot: root, tsconfig: config },
    {
      onError: (_location, error) => {
        throw error;
      },
      onInputChange: (change) => changes.push(change),
      onTopologyChange: () => {
        throw new Error("a selected plugin edit changed positional membership");
      },
    },
    observed.openDirectoryWatch,
    observed.openFileWatch,
  );
  try {
    topology.refresh(false);
    topology.setExtraInputs([plugin]);
    await settleWatchEvents();
    deliverWatchEvent(observed.watchers, plugin, "change");
    await settleWatchEvents();
    assert.deepEqual(
      [...changes],
      [],
      "unchanged plugin attention invented a source change",
    );
    for (const directory of [
      path.join(plugin, ".git"),
      path.join(plugin, "node_modules"),
    ]) {
      fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, "ignored.txt"), "excluded\n");
      deliverWatchEvent(observed.watchers, directory, "rename");
    }
    await settleWatchEvents();
    assert.deepEqual(
      [...changes],
      [],
      "a pruned directory leaked a plugin notification",
    );
    for (const edited of [goMod, nested]) {
      fs.appendFileSync(edited, "// edited\n");
      deliverWatchEvent(observed.watchers, edited, "change");
      await settleWatchEvents();
      assert.ok(
        changes.some(
          (change) => change.kind === "plugin" && change.path === edited,
        ),
        edited,
      );
    }
    const created = path.join(plugin, "internal", "newpkg");
    const added = path.join(created, "x.go");
    TestProject.copyDirectory(path.join(fixture, "inputs-2"), root);
    fs.renameSync(`${added}.txt`, added);
    const ignored = path.join(created, "node_modules", "pkg", "ignored.go");
    fs.renameSync(`${ignored}.txt`, ignored);
    const before = changes.length;
    deliverWatchEvent(observed.watchers, created, "rename");
    await settleWatchEvents();
    assert.ok(
      changes
        .slice(before)
        .some((change) => change.kind === "plugin" && change.path === added),
      "the newly registered directory lost its existing source",
    );
    assert.ok(changes.every((change) => change.kind === "plugin"));
    assert.ok(
      changes.every(
        (change) =>
          !change.path?.includes(`${path.sep}node_modules${path.sep}`),
      ),
    );
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: { noUnusedLocals: true },
        files: ["src/main.ts"],
      }),
    );
    deliverWatchEvent(observed.watchers, config, "change");
    await settleWatchEvents();
    assert.ok(
      changes.some(
        (change) => change.kind === "config" && change.path === config,
      ),
    );
  } finally {
    topology.close();
  }
  assert.ok(observed.watchers.every((watcher) => !watcher.active));
  const freshObserved = recordWatchers(watchDirectoryThroughFsWatch);
  const quiet: WatchInputChange[] = [];
  const fresh = new WatchTopology(
    { cwd: root, files: [source], projectRoot: root, tsconfig: config },
    {
      onError: (_location, error) => {
        throw error;
      },
      onInputChange: (change) => quiet.push(change),
      onTopologyChange: () => undefined,
    },
    freshObserved.openDirectoryWatch,
    freshObserved.openFileWatch,
  );
  try {
    fresh.refresh(false);
    fresh.setExtraInputs([plugin]);
    fresh.refresh(true);
    fresh.refresh(true);
    await settleWatchEvents();
    assert.deepEqual(
      quiet,
      [],
      "stable initial plugin bytes were reported as new",
    );
  } finally {
    fresh.close();
  }
  assert.ok(freshObserved.watchers.every((watcher) => !watcher.active));
}

/** Exercise only the existing topology publication operation, without Go. */
async function verifyPublicationHandoffs(): Promise<void> {
  const failures: unknown[] = [];
  for (const scenario of ["linked", "executable", "repeat", "switch", "recreate", "clear"] as const) {
    const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-plugin-publication-unit-"));
    const source = path.join(root, "main.ts");
    fs.writeFileSync(source, "export const input = 1;\n");
    const config = path.join(root, "tsconfig.json");
    fs.writeFileSync(config, JSON.stringify({ files: ["main.ts"] }));
    const fixture = path.join(TestProject.WORKSPACE_ROOT,
      "packages/ttsc/test/fixtures/unit/watch_plugin_notifications_report_only_keyed_source_changes/inputs-1");
    TestProject.copyDirectory(fixture, root);
    const module = path.join(root, "plugin");
    const packageDir = path.join(module, "internal", "mark");
    const originalGo = path.join(packageDir, "mark.go");
    fs.renameSync(`${originalGo}.txt`, originalGo);
    const observed = recordWatchers(watchDirectoryThroughFsWatch);
    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      { cwd: root, files: [source], projectRoot: root, tsconfig: config },
      {
        onError: (_location, error) => { throw error; },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => { throw new Error("Go interest changed compiler membership"); },
      },
      observed.openDirectoryWatch,
      observed.openFileWatch,
    );
    try {
      topology.refresh(false);
      topology.setExtraInputs([module, packageDir]);
      await settleWatchEvents();
      assert.deepEqual([...changes], [], "provisional source registration is initially quiet");
      let edited = originalGo;
      if (scenario === "switch") {
        const selected = path.join(root, "selected");
        TestProject.copyDirectory(fixture, selected);
        const nextModule = path.join(selected, "plugin");
        const nextPackage = path.join(nextModule, "internal", "mark");
        edited = path.join(nextPackage, "mark.go");
        fs.renameSync(`${edited}.txt`, edited);
        topology.setExtraInputs([nextModule, nextPackage]);
      } else if (scenario === "recreate") {
        const bytes = fs.readFileSync(originalGo);
        fs.rmSync(packageDir, { recursive: true });
        topology.refresh(true);
        fs.mkdirSync(packageDir, { recursive: true });
        fs.writeFileSync(originalGo, bytes);
        deliverWatchEvent(observed.watchers, packageDir, "rename");
        await settleWatchEvents();
        changes.length = 0;
      } else if (scenario === "executable") edited = path.join(module, "go.mod");
      fs.appendFileSync(edited, "// changed after preliminary publication\n");
      if (scenario === "linked") topology.setExtraInputs([packageDir]);
      if (scenario === "executable") topology.setExtraInputs([module]);
      if (scenario === "repeat") topology.setExtraInputs([module, packageDir]);
      if (scenario === "clear") topology.setExtraInputs([]);
      deliverWatchEvent(observed.watchers, edited, "change");
      await settleWatchEvents();
      if (scenario === "clear") assert.deepEqual([...changes], [], "empty selection retained plugin interests");
      else assert.ok(changes.some((change) => change.kind === "plugin" && change.path === edited),
        `${scenario} absorbed or lost the pre-read source change`);
    } catch (cause) {
      failures.push(new Error(scenario, { cause }));
    } finally {
      try {
        topology.close();
        assert.ok(observed.watchers.every((watcher) => !watcher.active));
      } catch (cause) {
        failures.push(new Error(`${scenario} watcher release`, { cause }));
      }
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "plugin publication handoffs failed");
}
