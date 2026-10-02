import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
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
 * 1. Admit the source at a fixed stamp and deliver an unchanged unnamed gap.
 * 2. Rewrite equal-length bytes, restore the stamp and deliver another gap.
 * 3. Require one source notification without a metadata-only false positive.
 *
 * @evidence contracts/testing.md#behavioral-verification An unchanged unnamed gap stays quiet, while a same-size rewrite with restored mtime produces exactly the tracked source path.
 * @evidence contracts/testing.md#independent-expectations Independent fixed timestamps and unequal equal-length source bytes require content rather than metadata to decide.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged unnamed gap stays quiet, while a same-size rewrite with restored mtime produces exactly the tracked source path; the native observer's uncontrolled event scheduling remains exercised by the separate actual fs.watch watch boundaries.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology and directory adapters consume recorded notifications and explicitly supplied absolute compiler membership. This unit starts no compiler process or native watcher; retained native E2E cases own compiler population and physical delivery. Every original semantic assertion remains in this unit.
 */
export async function test_watch_topology_rechecks_file_bytes_after_a_directory_gap() {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-watch-gap-"));
  const config = path.join(root, "tsconfig.json");
  const source = path.join(root, "src", "main.ts");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: { module: "commonjs", noEmit: true, strict: true },
      include: ["src"],
    }),
    "utf8",
  );
  fs.writeFileSync(source, "export const value = 1;\n", "utf8");
  const stamp = new Date(Math.floor(Date.now() / 1000) * 1000 - 60_000);
  fs.utimesSync(source, stamp, stamp);

  const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
    watchDirectoryThroughFsWatch,
  );
  const changes: WatchInputChange[] = [];
  const topology = new WatchTopology(
    { cwd: root, files: [], projectRoot: root, tsconfig: config },
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
    () => [source],
  );
  const gap = (): void => {
    const observing = watchers.filter(
      (watcher) =>
        watcher.active &&
        watcher.location !== source &&
        !path.relative(watcher.location, source).startsWith(".."),
    );
    assert.ok(observing.length > 0, "no directory watch covers the source");
    for (const watcher of observing) watcher.listener("rename", null);
  };
  try {
    topology.refresh(false);
    await settleWatchEvents();
    changes.length = 0;
    gap();
    await settleWatchEvents();
    assert.equal(changes.length, 0, "an empty gap caused a rebuild");

    fs.writeFileSync(source, "export const value = 2;\n", "utf8");
    fs.utimesSync(source, stamp, stamp);
    assert.equal(fs.statSync(source).mtimeMs, stamp.getTime());
    gap();
    await settleWatchEvents();
    assert.deepEqual(
      changes.map((change) => change.path),
      [source],
    );
  } finally {
    topology.close();
  }
}
