import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import { recordWatchers } from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a compiler source link keeps receiving changes after its target
 * moves.
 *
 * 1. Publish an external link pointing to a compiler tree and check its watcher.
 * 2. Retarget the link to an identical tree and deliver the replacement event.
 * 3. Deliver a source edit through the new physical watcher.
 * 4. Observe a missing target appearing and recover from a retarget during
 *    enumeration without a link event. Verify idle and close ownership of that
 *    retry and exercise raw target recovery where supported.
 *
 * @evidence contracts/testing.md#behavioral-verification The maintained WatchTopology reconciles a native directory junction or symlink while a supplied observer records the physical subscriptions and delivers events.
 * @evidence contracts/testing.md#independent-expectations The actual link target and the missing selected directory are checked before delivering their event. Exact registration handles establish which watch receives it and which must retire.
 * @evidence contracts/testing.md#distinguishing-cases Exercises retargeting, a source edit, missing-target appearance, and a retarget during enumeration whose empty destination produces no child notification. The idle barrier includes a retry queued by a pending notification, and close cancels an outstanding retry. Raw POSIX registration and delivery preserve exact bytes.
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
  let afterDirectoryRead: ((directory: fs.PathLike) => void) | undefined;
  const readDirectory = ((directory: fs.PathLike, ...args: unknown[]) => {
    const entries = Reflect.apply(fs.readdirSync, undefined, [
      directory,
      ...args,
    ]);
    afterDirectoryRead?.(directory);
    return entries;
  }) as typeof fs.readdirSync;
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
    readDirectory,
    () => assert.fail("a positional build does not need a compiler listing"),
  );
  const watchAt = (directory: string, from = 0) => {
    const matches = watchers
      .slice(from)
      .filter((watcher) => watcher.active && watcher.location === directory);
    assert.equal(matches.length, 1, `active watches at ${directory}`);
    return matches[0]!;
  };
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  const retarget = (target: string): void => {
    fs.unlinkSync(link);
    select(target);
    assert.equal(
      path.resolve(path.dirname(link), fs.readlinkSync(link)),
      path.dirname(target),
    );
  };
  const moveAfterListing = (prior: string, next: string): void => {
    afterDirectoryRead = (directory) => {
      if (directory !== prior) return;
      afterDirectoryRead = undefined;
      retarget(next);
    };
  };
  let byteFixture: { root: Buffer; source: Buffer; file: Buffer } | undefined;
  try {
    const beforePluginWatches = watchers.length;
    topology.setExtraInputs([alias]);
    const firstWatch = watchAt(first, beforePluginWatches);
    const linkWatch = watchAt(root, beforePluginWatches);
    retarget(second);
    linkWatch.listener("rename", path.basename(link));
    await flush();
    assert.equal(firstWatch.active, false);
    const secondWatch = watchAt(second);
    assert.ok(changes.some(({ kind }) => kind === "plugin"));
    changes.length = 0;
    const edited = path.join(second, "compiler.go");
    fs.appendFileSync(edited, "var Edited = true\n");
    secondWatch.listener("change", path.basename(edited));
    await flush();
    assert.deepEqual(changes, [
      { kind: "plugin", path: path.join(alias, "compiler.go") },
    ]);

    const missing = path.join(root, "missing", "src");
    retarget(missing);
    assert.equal(fs.statSync(alias, { throwIfNoEntry: false }), undefined);
    assert.ok(linkWatch.active);
    const beforeMissingWatch = watchers.length;
    linkWatch.listener("rename", path.basename(link));
    await flush();
    assert.equal(
      secondWatch.active,
      false,
      "the previous target handle closes",
    );
    assert.equal(
      watchers.some((watcher) => watcher.active && watcher.location === second),
      false,
      "no replacement handle watches the previous target",
    );
    const missingWatch = watchAt(root, beforeMissingWatch);
    changes.length = 0;
    fs.mkdirSync(missing, { recursive: true });
    missingWatch.listener("rename", path.basename(path.dirname(missing)));
    await flush();
    const recoveredWatch = watchAt(missing);
    assert.ok(changes.some(({ kind }) => kind === "plugin"));

    // Publish an unrelated input to rescan the alias while its prior state
    // remains captured. The retarget happens after reading the old tree, and
    // no link event or new child announces it.
    const empty = path.join(root, "empty", "src");
    const extra = path.join(root, "extra");
    for (const directory of [empty, extra])
      fs.mkdirSync(directory, { recursive: true });
    changes.length = 0;
    moveAfterListing(missing, empty);
    topology.setExtraInputs([alias, extra]);
    assert.equal(
      afterDirectoryRead,
      undefined,
      "the listing retargeted the link",
    );
    assert.equal(recoveredWatch.active, false);
    assert.deepEqual(changes, []);
    await flush();
    const emptyWatch = watchAt(empty);
    assert.deepEqual(changes, [{ kind: "plugin", path: alias }]);
    await flush();
    assert.deepEqual(changes, [{ kind: "plugin", path: alias }]);

    const barrierTarget = path.join(root, "barrier", "src");
    fs.mkdirSync(barrierTarget, { recursive: true });
    changes.length = 0;
    moveAfterListing(empty, barrierTarget);
    emptyWatch.listener("rename", null);
    await topology.whenIdle();
    assert.equal(afterDirectoryRead, undefined);
    assert.equal(emptyWatch.active, false);
    const barrierWatch = watchAt(barrierTarget);
    assert.deepEqual(changes, [{ kind: "plugin", path: alias }]);

    const closeWithPendingRetry = async (directory: string): Promise<void> => {
      const closeTarget = path.join(root, "close", "src");
      const closeExtra = path.join(root, "close-extra");
      for (const location of [closeTarget, closeExtra])
        fs.mkdirSync(location, { recursive: true });
      moveAfterListing(directory, closeTarget);
      changes.length = 0;
      topology.setExtraInputs([alias, extra, closeExtra]);
      assert.equal(afterDirectoryRead, undefined);
      const beforeClose = watchers.length;
      const beforeByteClose = byteWatches.length;
      const idle = topology.whenIdle();
      topology.close();
      await idle;
      assert.equal(watchers.length, beforeClose);
      assert.equal(byteWatches.length, beforeByteClose);
      assert.ok(watchers.every((watcher) => !watcher.active));
      assert.deepEqual(changes, []);
    };
    if (process.platform === "win32") {
      await closeWithPendingRetry(barrierTarget);
      return;
    }
    const raw = Buffer.from([0xff, 0x2d, 0x72, 0x61, 0x77]);
    const rawParent = Buffer.concat([Buffer.from(`${root}/`), raw]);
    try {
      fs.mkdirSync(rawParent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EILSEQ") {
        await closeWithPendingRetry(barrierTarget);
        return;
      }
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
    assert.ok(linkWatch.active);
    linkWatch.listener("rename", path.basename(link));
    await flush();
    assert.equal(barrierWatch.active, false);
    const waiting = byteWatches.find(
      (watcher) => watcher.active && watcher.location.equals(rawParent),
    );
    assert.ok(waiting);
    changes.length = 0;
    fs.mkdirSync(rawSource);
    waiting.listener("rename", Buffer.from("src"));
    await flush();
    const recovered = byteWatches.find(
      (watcher) => watcher.active && watcher.location.equals(rawSource),
    );
    assert.ok(recovered);
    assert.deepEqual(changes, [{ kind: "plugin", path: alias }]);
    changes.length = 0;
    fs.writeFileSync(path.join(alias, "compiler.go"), "package compiler\n");
    recovered.listener("change", Buffer.from("compiler.go"));
    await flush();
    assert.deepEqual(changes, [
      { kind: "plugin", path: path.join(alias, "compiler.go") },
    ]);
    await closeWithPendingRetry(alias);
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
