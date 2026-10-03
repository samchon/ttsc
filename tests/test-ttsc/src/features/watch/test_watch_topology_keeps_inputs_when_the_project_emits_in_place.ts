import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

const WATCH_EVENT_DEADLINE_MS = 30_000;

/**
 * Verifies in-place output containment retains declared project inputs.
 *
 * Explicit compiler members and observer notifications exercise actual source
 * output inference and declared-input registration without a compiler child or
 * native subscription. Native path identity may query Windows capabilities.
 *
 * 1. Author in-place output config, a compiler source and a declared document.
 * 2. Register actual source topology and require nonempty declared watch roots.
 * 3. Edit the document, deliver its event and require the project transition.
 *
 * @evidence contracts/testing.md#behavioral-verification Drives the real WatchTopology with outDir equal to the project directory and a declared document input inside it: the project-input watch roots callback must report a nonempty root list, and an edit of the document delivered through the recorded subscription must produce an input change notification.
 * @evidence contracts/testing.md#independent-expectations Authored outDir dot, explicit source membership and a declared document establish the expected project root and exact project-kind document path. Expected registrations and events are literal, not derived from topology output.
 * @evidence contracts/testing.md#distinguishing-cases Initial admitted bytes stay quiet; a subsequent document edit reports one exact project event despite overlapping output containment. The exact kind/path rejects a wrong lane, while non-overlapping layouts belong to sibling output tests.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology runs config, output-containment and declared-input decisions with literal absolute compiler membership and recorded source-adapter subscriptions. No compiler child or native observer runs; retained E2E owns population and physical delivery. Original watch-root, report and cleanup assertions remain.
 */
export const test_watch_topology_keeps_inputs_when_the_project_emits_in_place =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-project-input-in-place-"),
    );
    const source = path.join(root, "src", "main.ts");
    const declared = path.join(root, "docs", "spec.md");
    for (const file of [source, declared]) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(declared, "# Contract\n", "utf8");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { outDir: "." },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    let watchRoots: readonly string[] = [];
    const observed = recordWatchers(watchDirectoryThroughFsWatch);
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onProjectInputWatchRoots: (roots) => {
          watchRoots = [...roots];
        },
        onTopologyChange: () => {},
      },
      observed.openDirectoryWatch,
      observed.openFileWatch,
      fs.readdirSync,
      () => [source],
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({ root, files: [declared], globs: [] });
      assert.notEqual(
        watchRoots.length,
        0,
        "an in-place output directory must not leave the declared input unwatched",
      );
      assert.deepEqual(watchRoots, [root]);
      await Promise.resolve();
      assert.deepEqual(changes, []);

      const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
      fs.writeFileSync(declared, "# Revised contract\n", "utf8");
      deliverWatchEvent(observed.watchers, declared, "change");
      while (changes.length === 0) {
        if (Date.now() >= deadline) {
          assert.fail("an edit to the declared input was never reported");
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await Promise.resolve();
      assert.deepEqual(changes, [{ kind: "project", path: declared }]);
    } finally {
      topology.close();
    }
    assert.ok(observed.watchers.every((watcher) => !watcher.active));
  };
