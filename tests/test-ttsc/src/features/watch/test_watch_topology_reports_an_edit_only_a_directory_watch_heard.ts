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
 * 1. Admit the authored config and compiler member through recorded observers.
 * 2. Change strict mode and notify only the containing directory subscription.
 * 3. Repeat admitted-byte directory delivery on every platform and retain one
 *    report.
 *
 * @evidence contracts/testing.md#behavioral-verification A changed config heard only by its directory produces one report; duplicate delivery of the admitted bytes produces none.
 * @evidence contracts/testing.md#independent-expectations The independent strict true-to-false config edit and literal single report establish directory-first ownership.
 * @evidence contracts/testing.md#distinguishing-cases A changed config heard only by its directory produces one config report; duplicate directory delivery of the admitted bytes produces none, including directory-only backends. This unit does not observe native event scheduling.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology and directory adapters consume recorded notifications and explicitly supplied absolute compiler membership. This unit starts no compiler process or native watcher; retained native E2E cases own compiler population and physical delivery. Every original semantic assertion remains in this unit.
 */
export async function test_watch_topology_reports_an_edit_only_a_directory_watch_heard() {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-directory-only-"),
  );
  const config = path.join(root, "tsconfig.json");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    config,
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

  const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
    watchDirectoryThroughFsWatch,
  );
  const changes: WatchInputChange[] = [];
  const topology = new WatchTopology(
    {
      cwd: root,
      files: [],
      projectRoot: root,
      tsconfig: config,
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
  const deliverToDirectoryWatchers = (): void => {
    const directories = watchers.filter(
      (watcher) =>
        watcher.active &&
        watcher.location !== config &&
        path.relative(watcher.location, config) === "tsconfig.json",
    );
    assert.notEqual(directories.length, 0, "no directory watch covers it");
    for (const watcher of directories)
      watcher.listener("change", "tsconfig.json");
  };
  try {
    topology.refresh(false);
    await settleWatchEvents();
    changes.length = 0;

    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: { module: "commonjs", noEmit: true, strict: false },
        include: ["src"],
      }),
      "utf8",
    );
    deliverToDirectoryWatchers();
    await settleWatchEvents();
    assert.equal(
      changes.filter((change) => change.path === config).length,
      1,
      `an edit only a directory watch heard: ${JSON.stringify(changes)}`,
    );

    // Where the file has a watcher of its own, both decide from the bytes, so
    // hearing the same bytes again reports nothing. A backend with directory
    // watches alone uses the same fingerprint decision.
    deliverToDirectoryWatchers();
    await settleWatchEvents();
    assert.equal(
      changes.filter((change) => change.path === config).length,
      1,
      `the same bytes were reported again: ${JSON.stringify(changes)}`,
    );
    assert.deepEqual(changes, [{ kind: "config", path: config }]);
  } finally {
    topology.close();
    assert.ok(watchers.every((watcher) => watcher.active === false));
  }
}
