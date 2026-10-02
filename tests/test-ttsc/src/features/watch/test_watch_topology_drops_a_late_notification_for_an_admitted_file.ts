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
 * 1. Admit the authored seed member and register its recorded observers.
 * 2. Supply the added member before its creation event and require one reload.
 * 3. Contrast admitted-byte late attention with a later actual content edit.
 *
 * @evidence contracts/testing.md#behavioral-verification Creation admits the new source once, metadata-only late attention stays quiet, and later changed bytes produce one named input notification.
 * @evidence contracts/testing.md#independent-expectations The authored before/after bytes and literal topology count one distinguish stale notification from a genuine post-admission edit.
 * @evidence contracts/testing.md#distinguishing-cases Creation admits the new source once, metadata-only late attention stays quiet, and later changed bytes produce one named input notification; the native observer's uncontrolled event scheduling remains exercised by the separate actual fs.watch watch boundaries.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology and directory adapters consume recorded notifications and explicitly supplied absolute compiler membership. This unit starts no compiler process or native watcher; retained native E2E cases own compiler population and physical delivery. Every original semantic assertion remains in this unit.
 */
export async function test_watch_topology_drops_a_late_notification_for_an_admitted_file() {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-watch-late-notification-"),
  );
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "commonjs", noEmit: true, strict: true },
      include: ["src"],
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "src", "seed.ts"),
    "export const seed = 1;\n",
    "utf8",
  );

  const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
    watchDirectoryThroughFsWatch,
  );
  const changes: WatchInputChange[] = [];
  let topologyChanges = 0;
  let compilerInputs = [path.join(root, "src", "seed.ts")];
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
      onTopologyChange: () => {
        topologyChanges += 1;
      },
    },
    openDirectoryWatch,
    openFileWatch,
    fs.readdirSync,
    () => compilerInputs,
  );
  try {
    topology.refresh(false);
    await settleWatchEvents();
    changes.length = 0;
    topologyChanges = 0;

    const value = path.join(root, "src", "later", "value.ts");
    fs.mkdirSync(path.dirname(value));
    fs.writeFileSync(value, "export const value = 1;\n", "utf8");
    compilerInputs = [...compilerInputs, value];
    deliverWatchEvent(watchers, path.dirname(value), "rename");
    await settleWatchEvents();
    assert.equal(topologyChanges, 1, "the creation did not admit the file");
    assert.deepEqual([...changes], []);

    fs.utimesSync(value, new Date(0), new Date(0));
    deliverWatchEvent(watchers, value, "change");
    await settleWatchEvents();
    assert.deepEqual(
      [...changes],
      [],
      "a notification for bytes the refresh admitted was reported",
    );

    fs.writeFileSync(value, "export const value = 2;\n", "utf8");
    deliverWatchEvent(watchers, value, "change");
    await settleWatchEvents();
    assert.deepEqual(
      changes.map((change) => change.path),
      [value],
      "an edit after admission was not reported",
    );
    assert.deepEqual(changes, [{ kind: "compiler", path: value }]);
    assert.equal(topologyChanges, 1);
  } finally {
    topology.close();
  }
  assert.ok(watchers.every((watcher) => !watcher.active));
}
