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
 * 1. Admit the source and JSON member, then declare the same JSON project input.
 * 2. Edit JSON and deliver the compiler subscription before the project one.
 * 3. Reverse the next delivery order and require one project report in both cases.
 *
 * @evidence contracts/testing.md#behavioral-verification Both compiler-first and project-first delivery produce exactly one project change for the shared JSON member.
 * @evidence contracts/testing.md#independent-expectations Explicit source/JSON compiler-membership paths and a separately declared JSON glob establish overlap; the import is authored fixture data rather than native discovery. Literal one-project-change expectations establish single ownership in each delivery order.
 * @evidence contracts/testing.md#distinguishing-cases Both compiler-first and project-first delivery produce exactly one project change for the shared JSON member; the native observer's uncontrolled event scheduling remains exercised by the separate actual fs.watch watch boundaries.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology and directory adapters consume recorded notifications and explicitly supplied absolute compiler membership. This unit starts no compiler process or native watcher; retained native E2E cases own compiler population and physical delivery. Every original semantic assertion remains in this unit.
 */
export async function test_watch_topology_hands_shared_json_content_to_one_lane() {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-shared-json-"),
  );
  const source = path.join(root, "src", "main.ts");
  const json = path.join(root, "api", "openapi.json");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.mkdirSync(path.dirname(json), { recursive: true });
  fs.writeFileSync(
    source,
    'import contract from "../api/openapi.json";\nexport const name = contract.name;\n',
  );
  fs.writeFileSync(json, '{"name":"before"}\n');
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        esModuleInterop: true,
        noEmit: true,
        resolveJsonModule: true,
      },
      include: ["src"],
    }),
  );

  const changes: WatchInputChange[] = [];
  const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
    watchDirectoryThroughFsWatch,
  );
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
    () => [source, json],
  );
  try {
    topology.refresh(false);
    await settleWatchEvents();
    const compilerWatchers = [...watchers];
    topology.setProjectInputs({
      files: [],
      globs: [path.join(root, "api", "**", "*.json")],
      root,
    });
    await settleWatchEvents();
    const projectWatchers = watchers.filter(
      (watcher) => !compilerWatchers.includes(watcher),
    );
    assert.ok(projectWatchers.length > 0, "no project watcher was installed");
    changes.length = 0;

    fs.writeFileSync(json, '{"name":"edited"}\n');
    deliverWatchEvent(compilerWatchers, json, "change");
    deliverWatchEvent(projectWatchers, json, "change");
    await settleWatchEvents();
    assert.deepEqual(changes, [{ kind: "project", path: json }]);

    changes.length = 0;
    fs.writeFileSync(json, '{"name":"again!"}\n');
    deliverWatchEvent(projectWatchers, json, "change");
    deliverWatchEvent(compilerWatchers, json, "change");
    await settleWatchEvents();
    assert.deepEqual(changes, [{ kind: "project", path: json }]);
  } finally {
    topology.close();
  }
  assert.ok(watchers.every((watcher) => !watcher.active));
}
