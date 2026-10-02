import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  type IRecordedWatcher,
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

const subscriptions = new WeakMap<WatchTopology, readonly IRecordedWatcher[]>();

/**
 * Verifies per-reference products and manually declared external project
 * inputs.
 *
 * 1. Author the actual solution/reference configs and literal source membership.
 * 2. Deliver a referenced build-info write and retain its quiet product outcome.
 * 3. Create an external exact input and a referenced glob member and observe both.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source config/reference traversal, output inference and project classification retain every original quiet and positive assertion through recorded subscriptions.
 * @evidence contracts/testing.md#independent-expectations Authored root/reference configs, separately literal source membership and exact build-info/input paths establish all expectations independently of topology output.
 * @evidence contracts/testing.md#distinguishing-cases A referenced exact JSON compiler product stays quiet while a same-directory glob member and missing external exact input produce project changes.
 * @evidence contracts/testing.md#execution-ownership This source unit owns manual project declarations and actual reference/output decisions with recorded observers. Native compiler population and OS delivery remain in the canonical configured CLI boundary.
 */
export const test_watch_topology_tracks_external_inputs_across_project_references =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-project-input-solution-"),
    );
    const external = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-project-input-external-"),
    );
    const referenced = path.join(root, "packages", "contract");
    fs.mkdirSync(path.join(referenced, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(referenced, "src", "index.ts"),
      "export const contract = 1;\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(referenced, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          composite: true,
          tsBuildInfoFile: "api/state.json",
        },
        files: ["src/index.ts"],
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        files: [],
        references: [{ path: "./packages/contract" }],
      }),
      "utf8",
    );
    fs.mkdirSync(path.join(referenced, "api"), { recursive: true });

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
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => {},
      },
      openDirectoryWatch,
      openFileWatch,
      fs.readdirSync,
      (project) => {
        if (project.root === root) return [];
        assert.equal(project.root, referenced);
        return [path.join(referenced, "src", "index.ts")];
      },
    );
    subscriptions.set(topology, watchers);
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [path.join(external, "docs", "spec.md")],
        globs: [path.join(referenced, "api", "**", "*.json")],
      });

      fs.writeFileSync(path.join(referenced, "api", "state.json"), "{}\n");
      notify(topology, path.join(referenced, "api", "state.json"), false);
      await quiet(changes);

      fs.mkdirSync(path.join(external, "docs"), { recursive: true });
      let previous = projectChanges(changes);
      fs.writeFileSync(
        path.join(external, "docs", "spec.md"),
        "# External\n",
        "utf8",
      );
      notify(topology, path.join(external, "docs", "spec.md"));
      await nextProjectChange(changes, previous);

      previous = projectChanges(changes);
      fs.writeFileSync(
        path.join(referenced, "api", "openapi.json"),
        "{}\n",
        "utf8",
      );
      notify(topology, path.join(referenced, "api", "openapi.json"));
      await nextProjectChange(changes, previous);
    } finally {
      topology.close();
    }
  };

function projectChanges(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

async function nextProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (projectChanges(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(`expected a project change after ${previous}`);
    }
    await delay(25);
  }
  await delay();
}

async function quiet(changes: readonly WatchInputChange[]): Promise<void> {
  const count = changes.length;
  await delay();
  assert.equal(changes.length, count, JSON.stringify(changes.slice(count)));
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function notify(
  topology: WatchTopology,
  changed: string,
  requireSubscription = true,
): void {
  const watchers = subscriptions.get(topology);
  assert.ok(watchers);
  let entry = TestProject.physicalPath(changed);
  while (
    !watchers.some((watcher) => {
      if (!watcher.active) return false;
      const relative = path.relative(watcher.location, entry);
      return (
        relative === "" ||
        relative === path.basename(entry) ||
        (watcher.recursive &&
          !relative.startsWith("..") &&
          !path.isAbsolute(relative))
      );
    })
  ) {
    const parent = path.dirname(entry);
    if (parent === entry) {
      assert.equal(
        requireSubscription,
        false,
        `no subscription covers ${changed}`,
      );
      return;
    }
    entry = parent;
  }
  deliverWatchEvent(watchers, entry, "rename");
}
