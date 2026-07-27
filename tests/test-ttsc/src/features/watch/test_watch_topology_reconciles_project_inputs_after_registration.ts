import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies project-input publication closes the snapshot-to-watcher handoff.
 *
 * A backend can return a watcher before it is ready to deliver its first event.
 * The post-registration reconciliation must discover an input created in that
 * window, coalesce repeated publications, deduplicate a real event that wins
 * the race, and stay silent after close.
 *
 * 1. Swallow the startup event and recover the synchronous input change once.
 * 2. Let a backend event win the race without producing a duplicate.
 * 3. Close before reconciliation and prove the queued scan stays silent.
 * 4. Reject one root while a healthy root still completes its handoff scan.
 */
export const test_watch_topology_reconciles_project_inputs_after_registration =
  async (): Promise<void> => {
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
    const originalWatch = fs.watch;
    const callbacks: fs.WatchListener<string>[] = [];
    const watchers: FakeWatcher[] = [];

    Object.defineProperty(fs, "watch", {
      configurable: true,
      value: ((
        _location: fs.PathLike,
        _options: fs.WatchOptions,
        listener: fs.WatchListener<string>,
      ) => {
        callbacks.push(listener);
        const watcher = new FakeWatcher();
        watchers.push(watcher);
        return watcher as unknown as fs.FSWatcher;
      }) as typeof fs.watch,
      writable: true,
    });

    try {
      await verifySwallowedStartupEvent(root, callbacks, watchers);
      await verifyBackendEventWins(root, callbacks);
      await verifyCloseCancelsReconciliation(root);
    } finally {
      Object.defineProperty(fs, "watch", {
        configurable: true,
        value: originalWatch,
        writable: true,
      });
    }
    await verifyUncoveredRootDoesNotDisableHealthyReconciliation();
  };

async function verifySwallowedStartupEvent(
  root: string,
  callbacks: readonly fs.WatchListener<string>[],
  watchers: readonly FakeWatcher[],
): Promise<void> {
  const changes: WatchInputChange[] = [];
  const input = path.join(root, "swallowed.md");
  const topology = createTopology(root, changes);
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

    assert.deepEqual(changes, [{ kind: "project", path: input }]);
    topology.setProjectInputs(snapshot);
    await Promise.resolve();
    assert.equal(changes.length, 1, "unchanged population reported twice");
  } finally {
    topology.close();
  }
  assert.equal(watchers[0]?.closeCount, 1);
}

async function verifyBackendEventWins(
  root: string,
  callbacks: readonly fs.WatchListener<string>[],
): Promise<void> {
  const changes: WatchInputChange[] = [];
  const input = path.join(root, "backend.md");
  const topology = createTopology(root, changes);
  try {
    topology.setProjectInputs({ files: [input], globs: [], root });
    fs.writeFileSync(input, "{}\n", "utf8");
    callbacks.at(-1)?.("rename", path.basename(input));
    await Promise.resolve();

    assert.deepEqual(changes, [{ kind: "project", path: input }]);
  } finally {
    topology.close();
  }
}

async function verifyCloseCancelsReconciliation(root: string): Promise<void> {
  const changes: WatchInputChange[] = [];
  const input = path.join(root, "closed.md");
  const topology = createTopology(root, changes);
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
  const originalWatch = fs.watch;
  const changes: WatchInputChange[] = [];
  const errors: NodeJS.ErrnoException[] = [];
  const unavailable: string[][] = [];

  Object.defineProperty(fs, "watch", {
    configurable: true,
    value: ((location: fs.PathLike) => {
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
    }) as typeof fs.watch,
    writable: true,
  });

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

    assert.deepEqual(changes, [{ kind: "project", path: healthyInput }]);
    assert.deepEqual(
      errors.map((error) => error.code),
      ["ENOSPC"],
    );
    assert.equal(unavailable.length, 1);
    assert.equal(unavailable[0]?.length, 1);
  } finally {
    topology.close();
    Object.defineProperty(fs, "watch", {
      configurable: true,
      value: originalWatch,
      writable: true,
    });
  }
}

function createTopology(
  root: string,
  changes: WatchInputChange[],
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
