import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies source topology decisions with authored compiler membership.
 *
 * Supplied subscriptions retain the original ordered notifications and handle
 * lifetimes. Literal absolute membership is supplied separately from actual
 * config parsing, path ownership and source fingerprint decisions.
 *
 * 1. Register the authored compiler member and selected Go source tree.
 * 2. Deliver unchanged plugin directory attention and require quietness.
 * 3. Edit the Go file and deliver both file and parent events to the plugin lane.
 *
 * @evidence contracts/testing.md#behavioral-verification Unchanged plugin bytes and metadata-only directory attention stay quiet, while changed contributor source produces a plugin notification.
 * @evidence contracts/testing.md#independent-expectations The authored Go source bytes and subsequent literal source edit define the unchanged and changed plugin build inputs independently.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged plugin bytes and metadata-only directory attention stay quiet, while changed contributor source produces a plugin notification; the native observer's uncontrolled event scheduling remains exercised by the separate actual fs.watch watch boundaries.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology and directory adapters consume recorded notifications and explicitly supplied absolute compiler membership. This unit starts no compiler process or native watcher; retained native E2E cases own compiler population and physical delivery. Every original semantic assertion remains in this unit.
 */
export async function test_watch_topology_drops_a_plugin_notification_that_moved_no_source() {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-watch-plugin-metadata-"),
  );
  const plugin = path.join(root, "plugin-go");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "commonjs", noEmit: true, strict: true },
      include: ["src"],
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    "export const value = 1;\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  const source = path.join(plugin, "main.go");
  fs.writeFileSync(source, "package main\n", "utf8");

  const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
    watchDirectoryThroughFsWatch,
  );
  const changes: WatchInputChange[] = [];
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
      onInputChange: (change) => changes.push(change),
      onTopologyChange: () => undefined,
    },
    openDirectoryWatch,
    openFileWatch,
    fs.readdirSync,
    () => [path.join(root, "src", "main.ts")],
  );
  try {
    topology.refresh(false);
    topology.setExtraInputs([plugin]);
    await settleWatchEvents();
    changes.length = 0;

    deliverWatchEvent(watchers, plugin, "change");
    await settleWatchEvents();
    assert.deepEqual(
      changes.filter((change) => change.kind === "plugin"),
      [],
      "a notification that moved no plugin source was reported",
    );

    fs.writeFileSync(source, "package main\n\n// edited\n", "utf8");
    deliverWatchEvent(watchers, source, "change");
    deliverWatchEvent(watchers, plugin, "change");
    await settleWatchEvents();
    assert.ok(
      changes.some(
        (change) => change.kind === "plugin" && change.path === source,
      ),
      JSON.stringify(changes),
    );
  } finally {
    topology.close();
  }
}
