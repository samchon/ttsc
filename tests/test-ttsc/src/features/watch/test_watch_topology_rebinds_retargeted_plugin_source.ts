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
 * 4. Point the link at a missing target and observe the target appearing. When the
 *    filesystem supports raw POSIX names, exercise the same recovery and a
 *    subsequent edit below a target whose path contains invalid UTF-8.
 *
 * @evidence contracts/testing.md#behavioral-verification The maintained WatchTopology reconciles a native directory junction or symlink while a supplied observer records the physical subscriptions and delivers events.
 * @evidence contracts/testing.md#independent-expectations The authored link and two separate physical trees establish expected registration ownership independently of the topology.
 * @evidence contracts/testing.md#distinguishing-cases An intermediate-link target change with identical source contents differs from the later edit through the new watcher and recovery when a missing target appears. Raw POSIX registration and delivery preserve exact bytes. The stale registration has to close.
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
  const byteWatches: {
    location: Buffer;
    active: boolean;
    listener: (event: "rename" | "change", name: Buffer) => void;
  }[] = [];
  const openWatch = ((location: fs.PathLike, ...args: unknown[]) => {
    if (!Buffer.isBuffer(location))
      return Reflect.apply(openFileWatch, undefined, [location, ...args]);
    const watcher = {
      location,
      active: true,
      listener: args[1] as (event: "rename" | "change", name: Buffer) => void,
      close: () => {
        watcher.active = false;
      },
      on: () => watcher,
    };
    byteWatches.push(watcher);
    return watcher;
  }) as typeof fs.watch;
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
    openWatch,
    fs.readdirSync,
    () => assert.fail("a positional build does not need a compiler listing"),
  );
  const active = (directory: string): boolean =>
    watchers.some(
      (watcher) => watcher.active && watcher.location === directory,
    );
  let byteFixture: { root: Buffer; source: Buffer; file: Buffer } | undefined;
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

    if (process.platform === "win32") return;
    const raw = Buffer.from([0xff, 0x2d, 0x72, 0x61, 0x77]);
    const rawParent = Buffer.concat([Buffer.from(`${root}/`), raw]);
    try {
      fs.mkdirSync(rawParent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EILSEQ") return;
      throw error;
    }
    const rawSource = Buffer.concat([rawParent, Buffer.from("/src")]);
    byteFixture = {
      root: rawParent,
      source: rawSource,
      file: Buffer.concat([rawSource, Buffer.from("/compiler.go")]),
    };
    fs.unlinkSync(link);
    fs.symlinkSync(rawParent, link, "dir");
    deliverWatchEvent(watchers, link, "rename");
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(active(missing), false);
    const waiting = byteWatches.find(
      (watcher) => watcher.active && watcher.location.equals(rawParent),
    );
    assert.ok(waiting);
    changes.length = 0;
    fs.mkdirSync(rawSource);
    waiting.listener("rename", Buffer.from("src"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    const recovered = byteWatches.find(
      (watcher) => watcher.active && watcher.location.equals(rawSource),
    );
    assert.ok(recovered);
    assert.deepEqual(changes, [{ kind: "plugin", path: alias }]);
    changes.length = 0;
    fs.writeFileSync(path.join(alias, "compiler.go"), "package compiler\n");
    recovered.listener("change", Buffer.from("compiler.go"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(changes, [
      { kind: "plugin", path: path.join(alias, "compiler.go") },
    ]);
  } finally {
    topology.close();
    assert.ok(byteWatches.every((watcher) => !watcher.active));
    if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink())
      fs.unlinkSync(link);
    if (byteFixture !== undefined) {
      if (fs.existsSync(byteFixture.file)) fs.unlinkSync(byteFixture.file);
      if (fs.existsSync(byteFixture.source)) fs.rmdirSync(byteFixture.source);
      fs.rmdirSync(byteFixture.root);
    }
  }
}
