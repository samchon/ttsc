import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { projectInputReloadEventShouldNotify } from "../../../../../packages/ttsc/src/launcher/internal/watch/projectInputReloadEventShouldNotify";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

const WATCH_EVENT_DEADLINE_MS = 30_000;

/**
 * Verifies reload declarations retain the cold lane across input lifecycles.
 *
 * Recorded source-adapter notifications drive actual project fingerprints and
 * reload decisions. A positional source requires no compiler-list operation.
 *
 * 1. Declare a missing reload file, a resolution directory and a warm document.
 * 2. Create, edit, delete and replace reload inputs through explicit
 *    notifications.
 * 3. Contrast the warm document and named/unnamed reload planning decisions.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: reload project inputs dominate the ordinary external-data lane. 1. Create, edit, delete, and atomically replace one initially missing file. 2. Create and rename entries in one resolution-topology directory. 3. Require cold config events for both executable reload declarations. 4. Keep an ordinary project file warm and classify filename-less deltas.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create, edit, delete, and atomically replace one initially missing file. 2. Create and rename entries in one resolution-topology directory. 3. Require cold config events for both executable reload declarations. 4. Keep an ordinary project file warm and classify filename-less deltas.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology and reload planning run with recorded subscriptions; the compiler-list provider throws if reached because positional membership needs no native reader. All original cold/warm lifecycle assertions, timeouts and cleanup remain; no compiler or native observer executes.
 */
export const test_watch_topology_treats_reload_project_inputs_as_cold_transitions =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-project-input-reload-"),
    );
    const source = path.join(root, "src", "main.ts");
    const tsconfig = path.join(root, "tsconfig.json");
    const reloadFile = path.join(root, "config", "lint.config.json");
    const reloadDirectory = path.join(root, "config-deps");
    const warmFile = path.join(root, "docs", "spec.md");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.mkdirSync(path.dirname(warmFile), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(warmFile, "initial\n", "utf8");
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({ files: ["src/main.ts"] }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    const observed = recordWatchers(watchDirectoryThroughFsWatch);
    const expect = (
      kind: WatchInputChange["kind"],
      changed: string,
      mutate: () => void,
    ): Promise<void> =>
      expectNextKind(changes, kind, () => {
        mutate();
        deliverWatchEvent(observed.watchers, changed, "rename");
      });
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [source],
        projectRoot: root,
        tsconfig,
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      observed.openDirectoryWatch,
      observed.openFileWatch,
      fs.readdirSync,
      () => {
        throw new Error(
          "positional reload units must not request compiler membership",
        );
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [reloadFile, warmFile],
        globs: [],
        reloadDirectories: [reloadDirectory],
        reloadFiles: [reloadFile],
      });
      await delay();

      fs.mkdirSync(path.dirname(reloadFile), { recursive: true });
      await expect("config", reloadFile, () =>
        fs.writeFileSync(reloadFile, '{"rules":{}}\n', "utf8"),
      );
      await expect("config", reloadFile, () =>
        fs.writeFileSync(reloadFile, '{"rules":{"no-var":"error"}}\n', "utf8"),
      );
      await expect("config", reloadFile, () => fs.rmSync(reloadFile));

      const replacement = path.join(root, "config", "lint.config.next.json");
      fs.writeFileSync(replacement, '{"rules":{"eqeqeq":"error"}}\n', "utf8");
      await delay();
      await expect("config", reloadFile, () =>
        fs.renameSync(replacement, reloadFile),
      );

      // Drain the directory's own creation first. It is a cold event in its
      // own right, so without waiting for it the wait below can be satisfied
      // by that late arrival and say nothing about how the manifest was
      // classified.
      await expect("config", reloadDirectory, () =>
        fs.mkdirSync(reloadDirectory, { recursive: true }),
      );
      const packageManifest = path.join(reloadDirectory, "package.json");
      await expect("config", packageManifest, () =>
        fs.writeFileSync(packageManifest, '{"main":"index.cjs"}\n', "utf8"),
      );
      const replacementManifest = path.join(
        reloadDirectory,
        "package.next.json",
      );
      await expect("config", packageManifest, () =>
        fs.renameSync(packageManifest, replacementManifest),
      );

      await expect("project", warmFile, () =>
        fs.writeFileSync(warmFile, "warm edit\n", "utf8"),
      );
      assert.equal(
        changes.some(
          (change) =>
            change.kind === "project" &&
            change.path !== undefined &&
            path.resolve(change.path) === path.resolve(reloadFile),
        ),
        false,
        JSON.stringify(changes),
      );

      assert.equal(
        projectInputReloadEventShouldNotify({
          changedInputs: [packageManifest],
          reloadDirectories: [reloadDirectory],
          reloadFiles: [reloadFile],
        }),
        true,
        "a directory member fingerprint delta must select the cold lane",
      );
      assert.equal(
        projectInputReloadEventShouldNotify({
          changedInputs: [warmFile],
          reloadDirectories: [reloadDirectory],
          reloadFiles: [reloadFile],
        }),
        false,
        "a filename-less warm-data delta must remain a project event",
      );
      assert.equal(
        projectInputReloadEventShouldNotify({
          changed: reloadFile,
          changedInputs: [],
          reloadDirectories: [reloadDirectory],
          reloadFiles: [reloadFile],
        }),
        true,
        "a named reload event stays cold even when bytes are unchanged",
      );
      assert.equal(
        projectInputReloadEventShouldNotify({
          changed: path.join(reloadDirectory, "new-package"),
          changedInputs: [],
          reloadDirectories: [reloadDirectory],
          reloadFiles: [reloadFile],
        }),
        true,
        "a named resolution-topology event must select the cold lane",
      );
    } finally {
      topology.close();
    }
  };

async function expectNextKind(
  changes: readonly WatchInputChange[],
  kind: WatchInputChange["kind"],
  mutate: () => void,
): Promise<void> {
  const previous = changes.filter((change) => change.kind === kind).length;
  mutate();
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (changes.filter((change) => change.kind === kind).length === previous) {
    if (Date.now() >= deadline) {
      assert.fail(`expected ${kind}: ${JSON.stringify(changes)}`);
    }
    await delay(25);
  }
  await delay();
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
