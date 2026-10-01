import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";

/**
 * Verifies project-input publication closes the snapshot-to-watcher handoff.
 *
 * A backend can return a watcher before it is ready to deliver its first event.
 * The post-registration reconciliation must discover an input created in that
 * window, coalesce repeated publications, deduplicate a real event that wins
 * the race, and stay silent after close.
 *
 * 1. Swallow the startup event and recover the synchronous input change once, then
 *    let a backend event win the race without a duplicate.
 * 2. Close before reconciliation and prove the queued scan stays silent.
 * 3. Reject one root while a healthy root still completes its handoff scan, and
 *    materialize a symlink retaining both its declared and physical owners.
 * 4. Keep an unchanged republication from starting a polling-style rescan.
 *
 * @evidence contracts/testing.md#behavioral-verification Preserves startup recovery, event-first deduplication, close cancellation, uncovered versus healthy roots, newly materialized link owners and quiet unchanged republication.
 * @evidence contracts/testing.md#independent-expectations Literal created input bytes, exact notification and handle counts, explicit rejected-root errors and distinct lexical/physical owners define the publication contract.
 * @evidence contracts/testing.md#distinguishing-cases Preserves startup recovery, event-first deduplication, close cancellation, uncovered versus healthy roots, newly materialized link owners and quiet unchanged republication; uncontrolled native scheduling remains covered by the retained actual fs.watch watch boundaries.
 * @evidence contracts/testing.md#execution-ownership The named src/features/watch function directly calls authored WatchTopology project-input publication and recovery operations through explicit supplied observer callbacks; no refresh/listFilesOnly, product host, native build or installed consumer is executed.
 */
export async function test_watch_topology_reconciles_project_inputs_after_registration() {
    const root = TestProject.tmpdir("ttsc-project-input-registration-");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      "export const value = 1;\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({ files: ["src/main.ts"] }),
      "utf8",
    );
    const callbacks: fs.WatchListener<string>[] = [];
    const watchers: FakeWatcher[] = [];

    const openFileWatch = ((
        _location: fs.PathLike,
        _options: fs.WatchOptions,
        listener: fs.WatchListener<string>,
      ) => {
        callbacks.push(listener);
        const watcher = new FakeWatcher();
        watchers.push(watcher);
        return watcher as unknown as fs.FSWatcher;
      }) as typeof fs.watch;

    try {
      await verifySwallowedStartupEvent(root, callbacks, watchers, openFileWatch);
      await verifyBackendEventWins(root, callbacks, openFileWatch);
      await verifyCloseCancelsReconciliation(root, openFileWatch);
    } finally {

    }
    await verifyUncoveredRootDoesNotDisableHealthyReconciliation();
    await verifyReconciliationRegistersNewPhysicalOwner();
}

async function verifySwallowedStartupEvent(
  root: string,
  callbacks: readonly fs.WatchListener<string>[],
  watchers: readonly FakeWatcher[], openFileWatch: typeof fs.watch = fs.watch,
): Promise<void> {
  const changes: WatchInputChange[] = [];
  const input = path.join(root, "swallowed.md");
  const topology = createTopology(root, changes, openFileWatch);
  try {
    const snapshot = { files: [input], globs: [], root };
    topology.setProjectInputs(snapshot);
    topology.setProjectInputs(snapshot);
    fs.writeFileSync(input, "{}\n", "utf8");

    assert.equal(
      callbacks.length,
      1,
      "unchanged publication replaced its root",
    );
    assert.equal(watchers.length, 1, "unchanged publication added a watcher");
    await Promise.resolve();

    assert.deepEqual(changes, [
      { kind: "project", path: fs.realpathSync.native(input) },
    ]);
    fs.writeFileSync(input, '{"updated":true}\n', "utf8");
    topology.setProjectInputs(snapshot);
    await Promise.resolve();
    assert.equal(
      changes.length,
      1,
      "unchanged republication started an event-independent rescan",
    );
  } finally {
    topology.close();
  }
  assert.equal(watchers[0]?.closeCount, 1);
}

async function verifyBackendEventWins(
  root: string,
  callbacks: readonly fs.WatchListener<string>[], openFileWatch: typeof fs.watch = fs.watch,
): Promise<void> {
  const changes: WatchInputChange[] = [];
  const input = path.join(root, "backend.md");
  const topology = createTopology(root, changes, openFileWatch);
  try {
    topology.setProjectInputs({ files: [input], globs: [], root });
    fs.writeFileSync(input, "{}\n", "utf8");
    callbacks.at(-1)?.("rename", path.basename(input));
    await Promise.resolve();

    assert.deepEqual(changes, [
      { kind: "project", path: fs.realpathSync.native(input) },
    ]);
  } finally {
    topology.close();
  }
}

async function verifyCloseCancelsReconciliation(root: string, openFileWatch: typeof fs.watch = fs.watch): Promise<void> {
  const changes: WatchInputChange[] = [];
  const input = path.join(root, "closed.md");
  const topology = createTopology(root, changes, openFileWatch);
  topology.setProjectInputs({ files: [input], globs: [], root });
  topology.close();
  fs.writeFileSync(input, "{}\n", "utf8");
  await Promise.resolve();

  assert.deepEqual(changes, []);
}

async function verifyUncoveredRootDoesNotDisableHealthyReconciliation(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-project-input-registration-mixed-");
  const externalRoot = TestProject.tmpdir(
    "ttsc-project-input-registration-unavailable-",
  );
  const healthyInput = path.join(root, "healthy.md");
  const unavailableInput = path.join(externalRoot, "unavailable.md");
  const changes: WatchInputChange[] = [];
  const errors: NodeJS.ErrnoException[] = [];
  const unavailable: string[][] = [];

  const openFileWatch = ((location: fs.PathLike) => {
      if (
        fs.realpathSync.native(location) ===
        fs.realpathSync.native(externalRoot)
      ) {
        const error = new Error(
          "project-input watcher unavailable",
        ) as NodeJS.ErrnoException;
        error.code = "ENOSPC";
        throw error;
      }
      return new FakeWatcher() as unknown as fs.FSWatcher;
    }) as typeof fs.watch;

  const topology = new WatchTopology(
    {
      cwd: root,
      files: [],
      projectRoot: root,
      tsconfig: path.join(root, "tsconfig.json"),
    },
    {
      onError: (_location, error) =>
        errors.push(error as NodeJS.ErrnoException),
      onInputChange: (change) => changes.push(change),
      onProjectInputWatchUnavailable: (roots) => {
        unavailable.push([...roots]);
      },
      onTopologyChange: () => {
        throw new Error(
          "project-input reconciliation changed compiler topology",
        );
      },
    },
    (location, recursive, listener) => watchDirectoryThroughFsWatch(location, recursive, listener, openFileWatch),
    openFileWatch,
  );
  try {
    topology.setProjectInputs({
      files: [healthyInput, unavailableInput],
      globs: [],
      root,
    });
    fs.writeFileSync(healthyInput, "{}\n", "utf8");
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(changes, [
      { kind: "project", path: fs.realpathSync.native(healthyInput) },
    ]);
    assert.deepEqual(
      errors.map((error) => error.code),
      ["ENOSPC"],
    );
    assert.equal(unavailable.length, 1);
    assert.equal(unavailable[0]?.length, 1);
  } finally {
    topology.close();

  }
}

async function verifyReconciliationRegistersNewPhysicalOwner(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-project-input-registration-link-");
  const externalRoot = TestProject.tmpdir(
    "ttsc-project-input-registration-target-",
  );
  const link = path.join(root, "linked");
  const first = path.join(externalRoot, "first.md");
  const second = path.join(externalRoot, "second.md");
  const changes: WatchInputChange[] = [];
  const registrations: Array<{
    listener: fs.WatchListener<string>;
    location: string;
    watcher: FakeWatcher;
  }> = [];

  const openFileWatch = ((
      location: fs.PathLike,
      _options: fs.WatchOptions,
      listener: fs.WatchListener<string>,
    ) => {
      const watcher = new FakeWatcher();
      registrations.push({
        listener,
        location: fs.realpathSync.native(location),
        watcher,
      });
      return watcher as unknown as fs.FSWatcher;
    }) as typeof fs.watch;

  const topology = createTopology(root, changes, openFileWatch);
  try {
    topology.setProjectInputs({
      files: [],
      globs: [path.join(link, "**", "*.md").split(path.sep).join("/")],
      root,
    });
    fs.writeFileSync(first, "# first\n", "utf8");
    fs.symlinkSync(
      externalRoot,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    await Promise.resolve();

    assert.deepEqual(changes, [
      { kind: "project", path: fs.realpathSync.native(first) },
    ]);
    const externalRegistration = registrations.find(
      ({ location }) => location === fs.realpathSync.native(externalRoot),
    );
    assert.ok(
      externalRegistration,
      "handoff did not register the new physical owner",
    );

    fs.writeFileSync(second, "# second\n", "utf8");
    externalRegistration.listener("rename", path.basename(second));
    assert.deepEqual(changes, [
      { kind: "project", path: fs.realpathSync.native(first) },
      { kind: "project", path: fs.realpathSync.native(second) },
    ]);
  } finally {
    topology.close();

  }
  assert.ok(
    registrations.every(({ watcher }) => watcher.closeCount === 1),
    "close did not drain every declared and physical owner",
  );
}

function createTopology(
  root: string,
  changes: WatchInputChange[], openFileWatch: typeof fs.watch = fs.watch, readDirectory: typeof fs.readdirSync = fs.readdirSync,
): WatchTopology {
  return new WatchTopology(
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
      onTopologyChange: () => {
        throw new Error("project-input publication changed compiler topology");
      },
    },
    // Every directory watch goes through the explicitly supplied subscription operation.
    (location, recursive, listener) => watchDirectoryThroughFsWatch(location, recursive, listener, openFileWatch),
    openFileWatch,
    readDirectory,
  );
}

class FakeWatcher {
  public closeCount = 0;

  public close(): void {
    this.closeCount += 1;
  }

  public on(_event: "error", _listener: (error: Error) => void): FakeWatcher {
    return this;
  }
}
