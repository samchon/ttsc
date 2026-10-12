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
 * Verifies a change of plugin inputs is answered from the compiler's last
 * listing, while every refresh that can move Program membership still lists
 * (samchon/ttsc#1741).
 *
 * A plugin load reports its watch inputs up to three times with different sets,
 * and each set re-listed the compiler inputs: `ttsc check --watch` spawned
 * `tsgo --listFilesOnly` about nine times per rebuild. Plugin inputs join the
 * watched files and directories, never the compiler's membership.
 *
 * 1. Report three growing plugin-input sets after the first listing: none of them
 *    asks the compiler, and an edit in the last-added module is reported.
 * 2. Refresh as a notification does: the compiler is asked again, and a member it
 *    adds is watched.
 * 3. Report plugin inputs before any listing: the compiler is asked once.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual WatchTopology counts calls of its compiler-input operation through setExtraInputs and refresh, and reports a real plugin source edit and a real new member's edit through recorded watchers.
 * @evidence contracts/testing.md#independent-expectations The listing count follows the authored sequence of operations; the authored edits fix which changes are reported.
 * @evidence contracts/testing.md#distinguishing-cases Plugin-input changes after a listing, a membership refresh with a new member, and plugin inputs before any listing are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its temporary project, plugin modules and recorded watchers; the compiler-input operation is supplied, so no compiler or OS subscription starts.
 */
export async function test_watch_topology_answers_plugin_input_changes_from_the_last_compiler_listing(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-plugin-listing-"),
  );
  const main = path.join(root, "src", "main.ts");
  const added = path.join(root, "src", "added.ts");
  fs.mkdirSync(path.dirname(main), { recursive: true });
  fs.writeFileSync(main, "export const value = 1;\n");
  fs.writeFileSync(added, "export const added = 1;\n");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { noEmit: true }, include: ["src"] }),
  );
  const modules = ["first", "second", "third"].map((name) => {
    const directory = path.join(root, "plugins", name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "main.go"), `package ${name}\n`);
    return directory;
  });

  let members = [main];
  let listings = 0;
  const session = () => {
    const recorder = recordWatchers(watchDirectoryThroughFsWatch);
    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      { cwd: root, files: [], tsconfig: path.join(root, "tsconfig.json") },
      {
        onError: (_location, error) => {
          throw error;
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      recorder.openDirectoryWatch,
      recorder.openFileWatch,
      fs.readdirSync,
      () => {
        ++listings;
        return members;
      },
    );
    return { changes, topology, watchers: recorder.watchers };
  };

  const listed = session();
  try {
    listed.topology.refresh(false);
    assert.equal(listings, 1, "the first refresh lists");
    for (let count = 1; count <= modules.length; count++)
      listed.topology.setExtraInputs(modules.slice(0, count));
    assert.equal(listings, 1, "no plugin-input change lists");
    await settleWatchEvents();
    listed.changes.length = 0;
    const source = path.join(modules[2]!, "main.go");
    fs.writeFileSync(source, "package third\n\nconst Edited = true\n");
    deliverWatchEvent(listed.watchers, source, "change");
    deliverWatchEvent(listed.watchers, modules[2]!, "change");
    await settleWatchEvents();
    assert.ok(
      listed.changes.some((change) => change.kind === "plugin"),
      `the last-added module is watched: ${JSON.stringify(listed.changes)}`,
    );

    // The directory notification above may have listed already, as any
    // notification that can move membership does.
    const beforeRefresh = listings;
    members = [main, added];
    listed.topology.refresh(true);
    assert.equal(
      listings,
      beforeRefresh + 1,
      "a refresh that can move membership lists",
    );
    await settleWatchEvents();
    listed.changes.length = 0;
    fs.writeFileSync(added, "export const added = 2;\n");
    deliverWatchEvent(listed.watchers, added, "change");
    await settleWatchEvents();
    assert.deepEqual(listed.changes, [{ kind: "compiler", path: added }]);
  } finally {
    listed.topology.close();
  }
  assert.ok(listed.watchers.every((watcher) => !watcher.active));

  const unlisted = session();
  const before = listings;
  try {
    unlisted.topology.setExtraInputs(modules);
    assert.equal(
      listings,
      before + 1,
      "plugin inputs before any listing list once",
    );
  } finally {
    unlisted.topology.close();
  }
  assert.ok(unlisted.watchers.every((watcher) => !watcher.active));
}
