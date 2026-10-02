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
 *
 * @evidence contracts/testing.md#behavioral-verification Actual WatchTopology classifies a config edit as config, suppresses unchanged plugin and pruned .git/node_modules events, reports go.mod and nested source edits as plugin, discovers a newly registered package's existing source and leaves stable refreshes quiet. Closing retires every recorded handle.
 * @evidence contracts/testing.md#independent-expectations Literal authored byte transitions and the declared config/plugin roles establish expected event kinds and paths. Notifications are supplied as stimuli, never as expected topology output.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged root attention, pruned-directory attention, module/source edits and populated newly created directories distinguish observer attention from actual keyed source movement. A fresh topology admits those same bytes without reporting them as new.
 * @evidence contracts/testing.md#execution-ownership The source unit calls actual WatchTopology, source digest and directory adapter operations with explicitly recorded subscriptions. A positional source requires no compiler-list process; no native subscription, installation or build runs here. The retained native watcher E2E population owns actual delivery.
 */
export async function test_watch_plugin_notifications_report_only_keyed_source_changes(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-plugin-notifications-unit-"),
  );
  const source = path.join(root, "src", "main.ts");
  const config = path.join(root, "tsconfig.json");
  const plugin = path.join(root, "plugin");
  const goMod = path.join(plugin, "go.mod");
  const nested = path.join(plugin, "internal", "mark", "mark.go");
  for (const [location, bytes] of [
    [source, "export const value = 1;\n"],
    [config, JSON.stringify({ files: ["src/main.ts"] })],
    [goMod, "module example.com/plugin\n\ngo 1.26\n"],
    [nested, "package mark\n"],
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
    fs.mkdirSync(created);
    fs.writeFileSync(added, "package newpkg\n");
    fs.mkdirSync(path.join(created, "node_modules", "pkg"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(created, "node_modules", "pkg", "ignored.go"),
      "package ignored\n",
    );
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
