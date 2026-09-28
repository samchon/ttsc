import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../internal/recorded-watchers";

/**
 * Verifies one JSON content edit shared by compiler and project inputs builds
 * once.
 *
 * A resolveJsonModule source can also be a declared project-input glob member.
 * Whichever watcher hears an edit first must consume it through one fingerprint
 * decision; separate compiler and project notifications schedule two builds.
 *
 * 1. Watch a Program importing JSON and declare that JSON as a project input.
 * 2. Edit it and deliver compiler watchers before project watchers.
 * 3. Edit again and reverse the delivery order, requiring one project change from
 *    each edit and no later compiler duplicate.
 */
export const test_watch_topology_hands_shared_json_content_to_one_lane =
  async (): Promise<void> => {
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
    const { openDirectoryWatch, restore, watchers } = recordWatchers();
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
      restore();
    }
  };
