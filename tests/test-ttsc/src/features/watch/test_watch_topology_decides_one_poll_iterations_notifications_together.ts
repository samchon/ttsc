import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the notifications one poll iteration delivers are decided together
 * in the check phase: one compiler listing and one project-input rescan, each
 * taken after every notification it absorbs (samchon/ttsc#1741).
 *
 * One filesystem change usually arrives as several notifications, rename and
 * change or create and modify, and each listed the compiler inputs with tsgo or
 * rescanned the project inputs again.
 *
 * 1. Create a source file and deliver its rename and change in one turn: nothing
 *    is decided synchronously, then one listing follows, and it includes the
 *    new file.
 * 2. Deliver another notification afterwards: it is decided in a batch of its own.
 * 3. Edit a declared project-input directory's entry and deliver two notifications
 *    in one turn: the directory is rescanned once.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual WatchTopology decides recorded notifications; compiler listings and reload-directory reads counted through its supplied operations are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations One decision per batch and a later batch for a later notification follow from the coalescing contract; the authored file fixes what the listing must contain.
 * @evidence contracts/testing.md#distinguishing-cases A compiler-lane pair, a later compiler notification and a project-input pair are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its temporary project and recorded watchers; the compiler-input operation is supplied, so no compiler or OS subscription starts.
 */
export async function test_watch_topology_decides_one_poll_iterations_notifications_together(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-notification-batch-"),
  );
  const source = path.join(root, "src");
  const docs = path.join(root, "docs");
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(source, "main.ts"), "export const a = 1;\n");
  fs.writeFileSync(path.join(docs, "a.md"), "# a\n");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { noEmit: true }, include: ["src"] }),
  );

  const listings: string[][] = [];
  let docsReads = 0;
  const recorder = recordWatchers(watchDirectoryThroughFsWatch);
  const topology = new WatchTopology(
    {
      cwd: root,
      files: [],
      projectRoot: root,
      tsconfig: path.join(root, "tsconfig.json"),
    },
    {
      onError: (_location, error) => {
        throw error;
      },
      onInputChange: () => undefined,
      onTopologyChange: () => undefined,
    },
    recorder.openDirectoryWatch,
    recorder.openFileWatch,
    ((location: fs.PathLike, options?: unknown) => {
      if (path.resolve(String(location)) === docs) docsReads++;
      return fs.readdirSync(location, options as never);
    }) as typeof fs.readdirSync,
    () => {
      const members = fs
        .readdirSync(source)
        .map((name) => path.join(source, name))
        .sort();
      listings.push(members);
      return members;
    },
  );
  const checkPhase = () =>
    new Promise<void>((resolve) => setImmediate(resolve));
  try {
    topology.refresh(false);
    await settleWatchEvents();

    const listed = listings.length;
    const added = path.join(source, "added.ts");
    fs.writeFileSync(added, "export const b = 1;\n");
    deliverWatchEvent(recorder.watchers, added, "rename");
    deliverWatchEvent(recorder.watchers, added, "change");
    assert.equal(listings.length, listed, "nothing is decided synchronously");
    await checkPhase();
    assert.equal(listings.length, listed + 1, "the pair lists once");
    assert.ok(listings.at(-1)!.includes(added), "the listing follows both");
    await settleWatchEvents();

    const later = listings.length;
    const another = path.join(source, "another.ts");
    fs.writeFileSync(another, "export const c = 1;\n");
    deliverWatchEvent(recorder.watchers, another, "rename");
    await checkPhase();
    assert.ok(listings.length > later, "a later notification lists again");
    await settleWatchEvents();

    topology.setProjectInputs({
      files: [],
      globs: [],
      reloadDirectories: [docs],
      reloadFiles: [],
      root,
    });
    await settleWatchEvents();
    const reads = docsReads;
    fs.writeFileSync(path.join(docs, "b.md"), "# b\n");
    deliverWatchEvent(recorder.watchers, path.join(docs, "b.md"), "rename");
    deliverWatchEvent(recorder.watchers, path.join(docs, "b.md"), "change");
    await checkPhase();
    assert.equal(docsReads, reads + 1, "the pair rescans the directory once");
  } finally {
    topology.close();
  }
  assert.ok(recorder.watchers.every((watcher) => !watcher.active));
}
