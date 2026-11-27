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
 * Verifies a compiler source link keeps receiving changes after its target
 * moves.
 *
 * 1. Publish an external link pointing to a compiler tree and check its watcher.
 * 2. Retarget the link to an identical tree and deliver the replacement event.
 * 3. Deliver a source edit through the new physical watcher.
 * 4. Point the link at a missing target and observe the target appearing.
 *
 * @evidence contracts/testing.md#behavioral-verification The maintained WatchTopology reconciles a native directory junction or symlink while a supplied observer records the physical subscriptions and delivers events.
 * @evidence contracts/testing.md#independent-expectations The authored link and two separate physical trees establish expected registration ownership independently of the topology.
 * @evidence contracts/testing.md#distinguishing-cases An intermediate-link target change with identical source contents differs from the later edit through the new watcher and recovery when a missing target appears. The stale registration has to close.
 * @evidence contracts/testing.md#execution-ownership The test owns all fixture paths and closes the topology. Event delivery is controlled through the public observer dependency without replacing native filesystem operations.
 */
export async function test_watch_topology_rebinds_retargeted_plugin_source(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-plugin-link-"),
  );
  const project = path.join(root, "project");
  const first = path.join(root, "a", "src");
  const second = path.join(root, "b", "src");
  const link = path.join(root, "compiler");
  const alias = path.join(link, "src");
  for (const directory of [project, first, second])
    fs.mkdirSync(directory, { recursive: true });
  const config = path.join(project, "tsconfig.json");
  const source = path.join(project, "main.ts");
  fs.writeFileSync(config, '{"files":["main.ts"]}');
  fs.writeFileSync(source, "export {};");
  for (const directory of [first, second])
    fs.writeFileSync(path.join(directory, "compiler.go"), "package compiler\n");
  const select = (target: string): void =>
    fs.symlinkSync(
      path.dirname(target),
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
  select(first);
  const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
    watchDirectoryThroughFsWatch,
  );
  const changes: WatchInputChange[] = [];
  const topology = new WatchTopology(
    { cwd: project, files: [source], projectRoot: project, tsconfig: config },
    {
      onError: (location, error) => {
        throw new Error(location, { cause: error });
      },
      onInputChange: (change) => changes.push(change),
      onTopologyChange: () => undefined,
    },
    openDirectoryWatch,
    openFileWatch,
    fs.readdirSync,
    () => assert.fail("a positional build does not need a compiler listing"),
  );
  const active = (directory: string): boolean =>
    watchers.some(
      (watcher) => watcher.active && watcher.location === directory,
    );
  try {
    topology.setExtraInputs([alias]);
    assert.equal(active(first), true);
    fs.unlinkSync(link);
    select(second);
    deliverWatchEvent(watchers, link, "rename");
    await settleWatchEvents();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(active(first), false);
    assert.equal(active(second), true);
    assert.ok(changes.some(({ kind }) => kind === "plugin"));
    changes.length = 0;
    const edited = path.join(second, "compiler.go");
    fs.appendFileSync(edited, "var Edited = true\n");
    deliverWatchEvent(watchers, edited, "change");
    await settleWatchEvents();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(changes, [
      { kind: "plugin", path: path.join(alias, "compiler.go") },
    ]);

    const missing = path.join(root, "missing", "src");
    fs.unlinkSync(link);
    select(missing);
    deliverWatchEvent(watchers, link, "rename");
    await settleWatchEvents();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(active(second), false);
    changes.length = 0;
    fs.mkdirSync(missing, { recursive: true });
    deliverWatchEvent(watchers, path.dirname(missing), "rename");
    await settleWatchEvents();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(active(missing), true);
    assert.ok(changes.some(({ kind }) => kind === "plugin"));
  } finally {
    topology.close();
    if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink())
      fs.unlinkSync(link);
  }
}
