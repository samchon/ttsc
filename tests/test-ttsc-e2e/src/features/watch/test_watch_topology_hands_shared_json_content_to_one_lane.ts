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
 *
 * @evidence contracts/testing.md#behavioral-verification Both compiler-first and project-first delivery produce exactly one project change for the shared JSON member.
 * @evidence contracts/testing.md#independent-expectations The source imports JSON and separately declares it as a project input; the literal one-project-change expectations establish single ownership.
 * @evidence contracts/testing.md#distinguishing-cases Both compiler-first and project-first delivery produce exactly one project change for the shared JSON member; the native observer's uncontrolled event scheduling remains exercised by the separate actual fs.watch watch boundaries.
 * @evidence contracts/testing.md#execution-ownership The named features/watch entry executes the shipped WatchTopology with real tsgo refresh and explicit owned subscription operations; its original assertions and subcase identities remain in this E2E population.
 * @evidence contracts/e2e.md#necessary-boundary Real tsgo refresh establishes imported resolveJsonModule membership, which overlaps a declared project-input glob; both event orders must produce one project change rather than duplicate compiler scheduling.
 * @evidence contracts/e2e.md#shared-execution Subcases share one E2E process, installed compiler and compiled launcher; different project origins, config transitions or membership mutations require their current compiler request. Observer registration itself installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable inputs; each topology owns its supplied subscriptions and existing finally/close paths release them. Explicit providers retain the original callback and failure behavior without global observer state leaking between cases.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and subcase input remains; the operation-provider rewrite changes only where observations are acquired, while actual compiler selection, content fingerprints, recovery and cleanup decisions remain the original semantic path.
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
    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers();
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
}
