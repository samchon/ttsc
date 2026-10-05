import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a population scan reports its actual deltas instead of a stale name.
 *
 * A late event for admitted bytes can discover a different member's change.
 * Advancing the complete snapshot must not attribute that member to the old
 * event or let a stale selection filename turn ordinary data into a reload.
 *
 * 1. Deliver a stale file event before the actual changed member's event.
 * 2. Keep stale selection events warm and multiple unrelated deltas unnamed.
 * 3. Preserve a directory event that contains all newly created glob members,
 *    including the resolution-directory digest its creation also moves.
 * 4. Retain an unselected immediate-entry name only for its own directory and
 *    leave independent directory and mixed member/directory deltas unnamed.
 *
 * @evidence contracts/testing.md#behavioral-verification Real project-input scans over authored file bytes report another changed member once, preserve warm data under a stale selection event, report multiple deltas without a false single path and retain actual directory causality.
 * @evidence contracts/testing.md#independent-expectations Literal file paths, authored byte transitions and explicit event delivery order establish the changed inputs; expected project versus config events do not derive from topology output.
 * @evidence contracts/testing.md#distinguishing-cases Existing-byte changes, a newly created exact member, stale selection names, multiple sibling deltas and a glob-directory creation with an ancestor resolution digest distinguish notification causality from observer attention. Unselected immediate entries retain their own native cause; unrelated directory-only and mixed member/directory deltas cannot share that single name.
 * @evidence contracts/testing.md#execution-ownership This source unit invokes the actual WatchTopology with owned subscription operations and real temporary input files. It performs no compiler refresh, native build or real filesystem subscription.
 */
export async function test_watch_topology_attributes_reconciled_project_changes_to_actual_inputs(): Promise<void> {
  const failures: unknown[] = [];
  for (const scenario of [
    "content",
    "creation",
    "selection",
    "multiple",
    "directory",
    "unselected",
    "unrelated-directories",
    "mixed",
  ] as const) {
    try {
      await verifyScenario(scenario);
    } catch (error) {
      failures.push(new Error(scenario, { cause: error }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "project-input attribution scenarios failed",
    );
}

async function verifyScenario(
  scenario:
    | "content"
    | "creation"
    | "selection"
    | "multiple"
    | "directory"
    | "unselected"
    | "unrelated-directories"
    | "mixed",
): Promise<void> {
  const directoryOnly =
    scenario === "unselected" || scenario === "unrelated-directories";
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-project-input-attribution-"),
  );
  const attention = path.join(root, "attention.md");
  const dataRoot = path.join(root, "data");
  const first = directoryOnly
    ? path.join(root, "untracked.md")
    : path.join(dataRoot, "first.md");
  const second = path.join(dataRoot, "second.md");
  const resolutionRoot = path.join(root, "resolution");
  fs.writeFileSync(attention, "already admitted\n");
  if (scenario !== "directory") fs.mkdirSync(dataRoot);
  if (scenario !== "creation" && scenario !== "directory" && !directoryOnly)
    fs.writeFileSync(first, "before\n");
  if (scenario === "multiple") fs.writeFileSync(second, "before\n");
  if (scenario === "mixed") fs.mkdirSync(resolutionRoot);
  const changes: WatchInputChange[] = [];
  const watchers: {
    location: string;
    listener: fs.WatchListener<string>;
    closed: boolean;
  }[] = [];
  const openFileWatch = ((
    location: fs.PathLike,
    _options: fs.WatchOptions,
    listener: fs.WatchListener<string>,
  ) => {
    const entry = { location: String(location), listener, closed: false };
    watchers.push(entry);
    return {
      close: () => {
        entry.closed = true;
      },
      on() {
        return this;
      },
    } as unknown as fs.FSWatcher;
  }) as typeof fs.watch;
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
        throw new Error("unexpected compiler refresh");
      },
    },
    (location, recursive, listener) =>
      watchDirectoryThroughFsWatch(
        location,
        recursive,
        listener,
        openFileWatch,
      ),
    openFileWatch,
  );
  const deliver = (location: string): void => {
    const watcher = watchers.find(
      (entry) => !entry.closed && entry.location === root,
    );
    assert.ok(watcher, "the authored root has no live subscription");
    watcher.listener("change", path.relative(root, location));
  };
  try {
    topology.setProjectInputs({
      root,
      files:
        scenario === "directory" || directoryOnly
          ? [attention]
          : [attention, first, ...(scenario === "multiple" ? [second] : [])],
      globs:
        scenario === "directory" ? [path.join(dataRoot, "**", "*.md")] : [],
      reloadFiles: scenario === "selection" ? [attention] : [],
      reloadDirectories:
        scenario === "mixed"
          ? [resolutionRoot]
          : directoryOnly
            ? [root, dataRoot]
            : scenario === "directory"
              ? [root]
              : [],
    });
    await Promise.resolve();
    assert.deepEqual(changes, []);
    if (scenario === "directory") fs.mkdirSync(dataRoot);
    fs.writeFileSync(first, "after\n");
    if (
      scenario === "multiple" ||
      scenario === "directory" ||
      scenario === "unrelated-directories"
    )
      fs.writeFileSync(second, "after\n");
    if (scenario === "mixed")
      fs.writeFileSync(path.join(resolutionRoot, "unselected.md"), "after\n");
    deliver(
      directoryOnly || scenario === "mixed"
        ? first
        : scenario === "directory"
          ? dataRoot
          : attention,
    );
    const expectedPath =
      scenario === "multiple" ||
      scenario === "unrelated-directories" ||
      scenario === "mixed"
        ? undefined
        : scenario === "directory"
          ? dataRoot
          : first;
    const expectedKind =
      directoryOnly || scenario === "mixed" ? "config" : "project";
    assert.deepEqual(changes, [{ kind: expectedKind, path: expectedPath }]);
    deliver(first);
    if (
      scenario === "multiple" ||
      scenario === "directory" ||
      scenario === "unrelated-directories"
    )
      deliver(second);
    await Promise.resolve();
    assert.deepEqual(
      changes,
      [{ kind: expectedKind, path: expectedPath }],
      "later member notifications must not repeat admitted bytes",
    );
  } finally {
    topology.close();
  }
  assert.ok(
    watchers.every((entry) => entry.closed),
    "owner close left a subscription live",
  );
}
