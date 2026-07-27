import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies compiler watchers close their snapshot-to-registration handoff.
 *
 * A backend can return a file or directory watcher before its first event is
 * deliverable. The bounded reconciliation must recover tracked-file and
 * Program-membership changes, rebind replaced POSIX files, and stay silent
 * after close.
 *
 * 1. Swallow every startup event and report one config change plus parse error.
 * 2. Swallow a new included source event and refresh compiler membership once.
 * 3. Let a real source event win the race without producing a duplicate.
 * 4. Rebind a POSIX atomic replacement and observe its next in-place edit.
 * 5. Close before reconciliation and prove the queued scan emits nothing.
 * 6. Drain every fake watcher exactly once in all scenarios.
 */
export const test_watch_topology_reconciles_compiler_inputs_after_registration =
  async (): Promise<void> => {
    await verifySwallowedConfigDeletion();
    await verifySwallowedCompilerMembership();
    await verifyBackendEventWinsReconciliation();
    await verifyAtomicReplacementRebindsPosixFileWatcher();
    await verifyCloseCancelsReconciliation();
  };

async function verifySwallowedConfigDeletion(): Promise<void> {
  const fixture = createFixture("ttsc-watch-compiler-registration-");
  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  const watchers: FakeWatcher[] = [];
  const originalWatch = fs.watch;

  Object.defineProperty(fs, "watch", {
    configurable: true,
    value: (() => {
      const watcher = new FakeWatcher();
      watchers.push(watcher);
      return watcher as unknown as fs.FSWatcher;
    }) as typeof fs.watch,
    writable: true,
  });

  const topology = createTopology(fixture.root, changes, errors);
  try {
    topology.refresh(false);
    fs.rmSync(fixture.config);
    await Promise.resolve();

    assert.deepEqual(changes, [
      { kind: "config", path: fixture.expectedConfig },
    ]);
    assert.equal(errors.length, 1, "the failed refresh was not reported");
  } finally {
    topology.close();
    Object.defineProperty(fs, "watch", {
      configurable: true,
      value: originalWatch,
      writable: true,
    });
  }
  assert.ok(watchers.length > 0, "the regression registered no watchers");
  assert.ok(
    watchers.every((watcher) => watcher.closeCount === 1),
    "close did not drain every compiler watcher",
  );
}

async function verifySwallowedCompilerMembership(): Promise<void> {
  const fixture = createFixture("ttsc-watch-compiler-membership-", {
    include: ["src/**/*.ts"],
  });
  const added = path.join(fixture.root, "src", "added.ts");
  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  const topologyChanges: number[] = [];
  const watchers: FakeWatcher[] = [];
  const originalWatch = fs.watch;

  Object.defineProperty(fs, "watch", {
    configurable: true,
    value: (() => {
      const watcher = new FakeWatcher();
      watchers.push(watcher);
      return watcher as unknown as fs.FSWatcher;
    }) as typeof fs.watch,
    writable: true,
  });

  const topology = createTopology(fixture.root, changes, errors, () =>
    topologyChanges.push(topologyChanges.length + 1),
  );
  try {
    topology.refresh(false);
    fs.writeFileSync(added, "export const added = true;\n", "utf8");
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(changes, []);
    assert.deepEqual(errors, []);
    assert.equal(
      topologyChanges.length,
      1,
      "the new compiler member did not refresh topology exactly once",
    );
  } finally {
    topology.close();
    Object.defineProperty(fs, "watch", {
      configurable: true,
      value: originalWatch,
      writable: true,
    });
  }
  assert.ok(watchers.length > 0, "the membership case registered no watchers");
  assert.ok(
    watchers.every((watcher) => watcher.closeCount === 1),
    "close did not drain every membership watcher",
  );
}

async function verifyBackendEventWinsReconciliation(): Promise<void> {
  const fixture = createFixture("ttsc-watch-compiler-registration-event-");
  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  const registrations: Array<{
    listener: fs.WatchListener<string>;
    location: string;
    watcher: FakeWatcher;
  }> = [];
  const originalWatch = fs.watch;

  Object.defineProperty(fs, "watch", {
    configurable: true,
    value: ((
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
    }) as typeof fs.watch,
    writable: true,
  });

  const topology = createTopology(fixture.root, changes, errors);
  try {
    topology.refresh(false);
    const registration = registrations
      .filter(({ location }) => isPathWithin(location, fixture.expectedSource))
      .sort((left, right) => right.location.length - left.location.length)[0];
    assert.ok(registration, "no compiler directory watcher covered the source");

    fs.writeFileSync(fixture.source, "export const value = 2;\n", "utf8");
    registration.listener(
      "change",
      path.relative(registration.location, fixture.expectedSource),
    );
    await Promise.resolve();

    assert.deepEqual(changes, [
      { kind: "compiler", path: fixture.expectedSource },
    ]);
    assert.deepEqual(errors, []);
  } finally {
    topology.close();
    Object.defineProperty(fs, "watch", {
      configurable: true,
      value: originalWatch,
      writable: true,
    });
  }
  assert.ok(
    registrations.every(({ watcher }) => watcher.closeCount === 1),
    "close did not drain every event-wins watcher",
  );
}

async function verifyAtomicReplacementRebindsPosixFileWatcher(): Promise<void> {
  if (process.platform === "win32") return;

  const fixture = createFixture("ttsc-watch-compiler-registration-replace-");
  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  const registrations: Array<{
    listener: fs.WatchListener<string>;
    location: string;
    watcher: FakeWatcher;
  }> = [];
  const originalWatch = fs.watch;

  Object.defineProperty(fs, "watch", {
    configurable: true,
    value: ((
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
    }) as typeof fs.watch,
    writable: true,
  });

  const topology = createTopology(fixture.root, changes, errors);
  try {
    topology.refresh(false);
    const replacement = path.join(fixture.root, "src", "main.next.ts");
    fs.writeFileSync(replacement, "export const value = 200;\n", "utf8");
    fs.renameSync(replacement, fixture.source);
    await Promise.resolve();

    const sourceRegistrations = registrations.filter(
      ({ location }) => location === fixture.expectedSource,
    );
    assert.equal(
      sourceRegistrations.length,
      2,
      "the atomic replacement retained its old per-file watcher",
    );
    assert.equal(sourceRegistrations[0]?.watcher.closeCount, 1);
    assert.deepEqual(changes, [
      { kind: "compiler", path: fixture.expectedSource },
    ]);

    fs.writeFileSync(fixture.source, "export const value = 3000;\n", "utf8");
    sourceRegistrations[1]?.listener("change", path.basename(fixture.source));
    await Promise.resolve();

    assert.deepEqual(changes, [
      { kind: "compiler", path: fixture.expectedSource },
      { kind: "compiler", path: fixture.expectedSource },
    ]);
    assert.deepEqual(errors, []);
  } finally {
    topology.close();
    Object.defineProperty(fs, "watch", {
      configurable: true,
      value: originalWatch,
      writable: true,
    });
  }
  assert.ok(
    registrations.every(({ watcher }) => watcher.closeCount === 1),
    "close did not drain every replacement watcher",
  );
}

async function verifyCloseCancelsReconciliation(): Promise<void> {
  const fixture = createFixture("ttsc-watch-compiler-registration-close-");
  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  const watchers: FakeWatcher[] = [];
  const originalWatch = fs.watch;

  Object.defineProperty(fs, "watch", {
    configurable: true,
    value: (() => {
      const watcher = new FakeWatcher();
      watchers.push(watcher);
      return watcher as unknown as fs.FSWatcher;
    }) as typeof fs.watch,
    writable: true,
  });

  const topology = createTopology(fixture.root, changes, errors);
  try {
    topology.refresh(false);
    topology.close();
    fs.rmSync(fixture.config);
    await Promise.resolve();

    assert.deepEqual(changes, []);
    assert.deepEqual(errors, []);
  } finally {
    topology.close();
    Object.defineProperty(fs, "watch", {
      configurable: true,
      value: originalWatch,
      writable: true,
    });
  }
  assert.ok(watchers.length > 0, "the close case registered no watchers");
  assert.ok(
    watchers.every((watcher) => watcher.closeCount === 1),
    "close drained a compiler watcher more than once",
  );
}

function createFixture(
  prefix: string,
  configJson: object = { files: ["src/main.ts"] },
): {
  config: string;
  expectedConfig: string;
  expectedSource: string;
  root: string;
  source: string;
} {
  const root = TestProject.tmpdir(prefix);
  const source = path.join(root, "src", "main.ts");
  const config = path.join(root, "tsconfig.json");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "export const value = 1;\n", "utf8");
  fs.writeFileSync(config, JSON.stringify(configJson), "utf8");
  return {
    config,
    expectedConfig: fs.realpathSync.native(config),
    expectedSource: fs.realpathSync.native(source),
    root,
    source,
  };
}

function isPathWithin(root: string, location: string): boolean {
  const relative = path.relative(root, location);
  return (
    relative === "" ||
    (path.isAbsolute(relative) === false &&
      relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false)
  );
}

function createTopology(
  root: string,
  changes: WatchInputChange[],
  errors: unknown[],
  onTopologyChange: () => void = () => undefined,
): WatchTopology {
  return new WatchTopology(
    {
      cwd: root,
      files: [],
      projectRoot: root,
      tsconfig: path.join(root, "tsconfig.json"),
    },
    {
      onError: (_location, error) => errors.push(error),
      onInputChange: (change) => changes.push(change),
      onTopologyChange,
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
