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
 * 1. Author the nine config, membership, lane, fingerprint and owner-handoff
 *    scenarios.
 * 2. Drive swallowed and event-first transitions, running the POSIX-only and
 *    Windows-only scenarios on their own platform and logging a skip elsewhere.
 * 3. Collect every scenario result and require exact reports, errors and handle
 *    retirements.
 *
 * @evidence contracts/testing.md#behavioral-verification Preserves all nine handoff scenarios: swallowed config and membership events, event-first deduplication, deleted JSON handoff, Windows mixed membership, transient directory failure, POSIX owner rebind, failed refresh containment and close cancellation.
 * @evidence contracts/testing.md#independent-expectations Authored config/source/JSON changes, literal error and notification counts, distinct inode assertions and exact close counts define independent handoff outcomes.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts: a swallowed config deletion reports one config change and one error while a swallowed new compiler member reports one topology refresh and no input change; a backend event that wins reconciliation reports exactly one compiler change; a consumed warm creation is not repeated by delayed project and compiler deliveries, a mixed source-plus-JSON membership keeps its broader topology reload, and reload-file and reload-directory deltas are consumed once; a first directory read that fails with ENOENT yields one config change and no error; an identical atomic replacement invents no change but a later edit does, and a rearm after a failed refresh neither repeats the config notice nor the error; after close nothing is reported. POSIX-only and Windows-only scenarios are logged as skipped on the other platform.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology and directory adapters consume recorded notifications and explicitly supplied absolute compiler membership. This unit starts no compiler process or native watcher; retained native E2E cases own compiler population and physical delivery. Every original semantic assertion remains in this unit.
 */
export async function test_watch_topology_reconciles_compiler_inputs_after_registration() {
  const failures: Error[] = [];
  for (const [run, platform] of [
    [verifySwallowedConfigDeletion, "any"],
    [verifySwallowedCompilerMembership, "any"],
    [verifyBackendEventWinsReconciliation, "any"],
    [verifyDeletedProjectMemberReconcilesBeforeFileNotification, "posix"],
    [verifyWindowsProjectCompilerMembershipHandoff, "win32"],
    [verifyTransientReloadDirectoryFingerprintRace, "any"],
    [verifyAtomicReplacementRebindsPosixFileWatcher, "posix"],
    [verifyFileRearmDoesNotRepeatCompilerRefresh, "posix"],
    [verifyCloseCancelsReconciliation, "any"],
  ] as const) {
    // A scenario owned by another platform is reported rather than passed
    // silently, so the run never claims coverage it did not execute.
    if (
      (platform === "posix" && process.platform === "win32") ||
      (platform === "win32" && process.platform !== "win32")
    ) {
      console.log(
        `  - ${run.name}: SKIPPED on ${process.platform} (${platform}-only scenario; no coverage claimed)`,
      );
      continue;
    }
    try {
      await run();
    } catch (error) {
      failures.push(new Error(run.name, { cause: error }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "watch registration handoffs failed");
}

const compilerMembership = new Map<string, string[]>();

async function verifySwallowedConfigDeletion(): Promise<void> {
  const fixture = createFixture("ttsc-watch-compiler-registration-");
  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  const watchers: FakeWatcher[] = [];

  const openFileWatch = (() => {
    const watcher = new FakeWatcher();
    watchers.push(watcher);
    return watcher as unknown as fs.FSWatcher;
  }) as typeof fs.watch;

  const topology = createTopology(
    fixture.root,
    changes,
    errors,
    undefined,
    openFileWatch,
  );
  try {
    topology.refresh(false);
    fs.rmSync(fixture.config);
    await Promise.resolve();

    assert.deepEqual(changes, [
      { kind: "config", path: fixture.reportedConfig },
    ]);
    assert.equal(errors.length, 1, "the failed refresh was not reported");
  } finally {
    topology.close();
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

  const openFileWatch = (() => {
    const watcher = new FakeWatcher();
    watchers.push(watcher);
    return watcher as unknown as fs.FSWatcher;
  }) as typeof fs.watch;

  const topology = createTopology(
    fixture.root,
    changes,
    errors,
    () => topologyChanges.push(topologyChanges.length + 1),
    openFileWatch,
  );
  try {
    topology.refresh(false);
    fs.writeFileSync(added, "export const added = true;\n", "utf8");
    compilerMembership.set(fixture.root, [fixture.reportedSource, added]);
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

  const topology = createTopology(
    fixture.root,
    changes,
    errors,
    undefined,
    openFileWatch,
  );
  try {
    topology.refresh(false);
    const registration = registrations
      .filter(({ location }) => isPathWithin(location, fixture.physicalSource))
      .sort((left, right) => right.location.length - left.location.length)[0];
    assert.ok(registration, "no compiler directory watcher covered the source");

    fs.writeFileSync(fixture.source, "export const value = 2;\n", "utf8");
    registration.listener(
      "change",
      path.relative(registration.location, fixture.physicalSource),
    );
    await Promise.resolve();

    assert.deepEqual(changes, [
      { kind: "compiler", path: fixture.reportedSource },
    ]);
    assert.deepEqual(errors, []);
  } finally {
    topology.close();
  }
  assert.ok(
    registrations.every(({ watcher }) => watcher.closeCount === 1),
    "close did not drain every event-wins watcher",
  );
}

async function verifyDeletedProjectMemberReconcilesBeforeFileNotification(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-watch-project-delete-handoff-");
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
  const errors: unknown[] = [];
  const recorded = recordWatchers(watchDirectoryThroughFsWatch);
  compilerMembership.set(root, [
    fs.realpathSync.native(source),
    fs.realpathSync.native(json),
  ]);
  const topology = createTopology(
    root,
    changes,
    errors,
    undefined,
    recorded.openFileWatch,
  );
  try {
    topology.refresh(false);
    topology.setProjectInputs({
      files: [],
      globs: [path.join(root, "api", "**", "*.json")],
      root,
    });
    await settleWatchEvents();

    const physicalJson = fs.realpathSync.native(json);
    const fileWatcher = recorded.watchers.find(
      (watcher) => watcher.active && watcher.location === physicalJson,
    );
    assert.ok(fileWatcher, "the compiler did not watch its JSON member");
    fs.rmSync(json);
    compilerMembership.set(root, [fs.realpathSync.native(source)]);
    fileWatcher.listener("rename", path.basename(json));
    deliverWatchEvent(
      recorded.watchers.filter((watcher) => watcher.recursive),
      physicalJson,
      "rename",
    );
    await settleWatchEvents();

    assert.deepEqual(changes, [
      { invalidate: true, kind: "project", path: physicalJson },
    ]);
    assert.deepEqual(errors, []);
  } finally {
    topology.close();
  }
}

async function verifyWindowsProjectCompilerMembershipHandoff(): Promise<void> {
  const fixture = createFixture("ttsc-watch-membership-handoff-", {
    compilerOptions: {
      esModuleInterop: true,
      module: "commonjs",
      noEmit: true,
      resolveJsonModule: true,
    },
    include: ["src"],
  });
  const first = path.join(fixture.root, "api", "first.json");
  const firstPeer = path.join(fixture.root, "api", "first-peer.json");
  const other = path.join(fixture.root, "contracts", "other.json");
  const mixed = path.join(fixture.root, "api", "mixed.json");
  const mixedSource = path.join(fixture.root, "src", "added.ts");
  const second = path.join(fixture.root, "api", "second.json");
  const third = path.join(fixture.root, "api", "third.json");
  const reloadDirectory = path.join(fixture.root, "config-deps");
  fs.mkdirSync(reloadDirectory, { recursive: true });
  fs.writeFileSync(
    fixture.source,
    [
      'import first from "../api/first.json";',
      'import firstPeer from "../api/first-peer.json";',
      'import other from "../contracts/other.json";',
      'import mixed from "../api/mixed.json";',
      'import second from "../api/second.json";',
      'import third from "../api/third.json";',
      "JSON.stringify([first, firstPeer, other, mixed, second, third]);",
      "",
    ].join("\n"),
    "utf8",
  );

  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  let topologyChanges = 0;
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
      location: path.resolve(location.toString()),
      watcher,
    });
    return watcher as unknown as fs.FSWatcher;
  }) as typeof fs.watch;

  const topology = createTopology(
    fixture.root,
    changes,
    errors,
    () => (topologyChanges += 1),
    openFileWatch,
  );
  try {
    topology.refresh(false);
    await Promise.resolve();
    const compiler = registrations[0];
    assert.ok(compiler, "the compiler watcher was not registered");
    const beforeProjectInputs = registrations.length;
    topology.setProjectInputs({
      files: [],
      globs: [
        path.join(fixture.root, "api", "**", "*.json"),
        path.join(fixture.root, "contracts", "**", "*.json"),
      ],
      reloadDirectories: [fixture.root, reloadDirectory],
      reloadFiles: [second],
      root: fixture.root,
    });
    const project = registrations[beforeProjectInputs];
    assert.ok(project, "the project-input watcher was not registered");

    fs.mkdirSync(path.dirname(first), { recursive: true });
    fs.mkdirSync(path.dirname(other), { recursive: true });
    fs.writeFileSync(first, '{"name":"created"}\n', "utf8");
    fs.writeFileSync(firstPeer, '{"name":"created"}\n', "utf8");
    fs.writeFileSync(other, '{"name":"created"}\n', "utf8");
    compilerMembership.set(fixture.root, [
      fixture.reportedSource,
      first,
      firstPeer,
      other,
    ]);
    topology.refresh(true);
    assert.deepEqual(changes, [
      { invalidate: true, kind: "project", path: undefined },
    ]);

    project.listener(
      "rename",
      path.relative(project.location, path.dirname(first)),
    );
    project.listener(
      "rename",
      path.relative(project.location, path.dirname(other)),
    );
    compiler.listener("change", path.relative(compiler.location, first));
    compiler.listener("change", path.relative(compiler.location, firstPeer));
    compiler.listener("change", path.relative(compiler.location, other));
    await Promise.resolve();
    assert.equal(
      changes.length,
      1,
      "delayed project/compiler deliveries repeated one consumed warm creation",
    );
    assert.equal(topologyChanges, 0);

    topology.setProjectInputs({
      files: [],
      globs: [
        path.join(fixture.root, "api", "**", "*.json"),
        path.join(fixture.root, "contracts", "**", "*.json"),
      ],
      reloadDirectories: [reloadDirectory],
      reloadFiles: [second],
      root: fixture.root,
    });
    fs.writeFileSync(mixed, '{"name":"created"}\n', "utf8");
    fs.writeFileSync(mixedSource, "export const added = true;\n", "utf8");
    compilerMembership.set(fixture.root, [
      fixture.reportedSource,
      first,
      firstPeer,
      other,
      mixed,
      mixedSource,
    ]);
    topology.refresh(true);
    assert.equal(
      topologyChanges,
      1,
      "mixed compiler membership did not retain its broader topology reload",
    );
    assert.equal(
      changes.length,
      1,
      "mixed compiler membership invented a narrower input callback",
    );
    project.listener(
      "rename",
      path.relative(project.location, path.dirname(mixed)),
    );
    compiler.listener("change", path.relative(compiler.location, mixed));
    await Promise.resolve();
    assert.equal(
      topologyChanges,
      1,
      "delayed mixed membership repeated its topology reload",
    );
    assert.equal(
      changes.length,
      1,
      "delayed project/compiler delivery escaped a mixed membership handoff",
    );

    fs.writeFileSync(second, '{"name":"created"}\n', "utf8");
    compilerMembership.set(fixture.root, [
      fixture.reportedSource,
      first,
      firstPeer,
      other,
      mixed,
      mixedSource,
      second,
    ]);
    topology.refresh(true);
    assert.deepEqual(changes.at(-1), {
      kind: "config",
      path: second,
    });
    project.listener(
      "rename",
      path.relative(project.location, path.dirname(second)),
    );
    compiler.listener("change", path.relative(compiler.location, second));
    await Promise.resolve();
    assert.equal(
      changes.length,
      2,
      "a consumed reload-file delta survived its cold handoff",
    );
    const stamp = fs.statSync(second);
    fs.writeFileSync(second, '{"name":"altered"}\n', "utf8");
    fs.utimesSync(second, stamp.atime, stamp.mtime);
    assert.equal(
      fs.statSync(second).size,
      stamp.size,
      "the strong-fingerprint case changed file size",
    );
    compiler.listener("change", path.relative(compiler.location, second));
    await Promise.resolve();
    assert.deepEqual(changes.at(-1), {
      kind: "config",
      path: second,
    });
    const afterReloadEdit = changes.length;
    project.listener("change", path.relative(project.location, second));
    await Promise.resolve();
    assert.equal(
      changes.length,
      afterReloadEdit,
      "the project watcher repeated a reload edit the compiler watcher consumed",
    );

    fs.writeFileSync(third, '{"name":"created"}\n', "utf8");
    compilerMembership.set(fixture.root, [
      fixture.reportedSource,
      first,
      firstPeer,
      other,
      mixed,
      mixedSource,
      second,
      third,
    ]);
    fs.writeFileSync(
      path.join(reloadDirectory, "selection.cjs"),
      "module.exports = 1;\n",
      "utf8",
    );
    topology.refresh(true);
    assert.deepEqual(changes.at(-1), {
      kind: "config",
      path: third,
    });
    project.listener(
      "rename",
      path.relative(project.location, path.dirname(third)),
    );
    compiler.listener("change", path.relative(compiler.location, third));
    await Promise.resolve();
    assert.equal(
      changes.length,
      4,
      "a consumed reload-directory delta survived its cold handoff",
    );
    assert.deepEqual(errors, []);
  } finally {
    topology.close();
  }
  assert.ok(
    registrations.every(({ watcher }) => watcher.closeCount === 1),
    "close did not drain every handoff watcher",
  );
}

async function verifyTransientReloadDirectoryFingerprintRace(): Promise<void> {
  const fixture = createFixture("ttsc-watch-reload-directory-race-");
  const reloadDirectory = path.join(fixture.root, "config-deps");
  fs.mkdirSync(reloadDirectory, { recursive: true });
  const reloadDirectoryIdentity = fs.realpathSync.native(reloadDirectory);
  fs.writeFileSync(
    path.join(reloadDirectory, "selection.cjs"),
    "module.exports = 1;\n",
    "utf8",
  );

  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  const watchers: FakeWatcher[] = [];
  const originalReaddirSync = fs.readdirSync;
  let injected = false;
  const openFileWatch = (() => {
    const watcher = new FakeWatcher();
    watchers.push(watcher);
    return watcher as unknown as fs.FSWatcher;
  }) as typeof fs.watch;
  const readDirectory = ((location: fs.PathLike, options?: unknown) => {
    if (
      !injected &&
      fs.realpathSync.native(location) === reloadDirectoryIdentity
    ) {
      injected = true;
      const error = new Error(
        "simulated transient directory race",
      ) as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }
    return Reflect.apply(originalReaddirSync, fs, [location, options]);
  }) as typeof fs.readdirSync;

  const topology = createTopology(
    fixture.root,
    changes,
    errors,
    undefined,
    openFileWatch,
    readDirectory,
  );
  try {
    topology.setProjectInputs({
      files: [],
      globs: [],
      reloadDirectories: [reloadDirectory],
      reloadFiles: [],
      root: fixture.root,
    });
    assert.equal(injected, true, "the transient fingerprint race was not run");

    await Promise.resolve();

    assert.deepEqual(changes, [
      {
        kind: "config",
        path: reloadDirectoryIdentity,
      },
    ]);
    assert.deepEqual(errors, []);
  } finally {
    topology.close();
  }
  assert.ok(
    watchers.every((watcher) => watcher.closeCount === 1),
    "close did not drain every reload-directory watcher",
  );
}

async function verifyAtomicReplacementRebindsPosixFileWatcher(): Promise<void> {
  const fixture = createFixture("ttsc-watch-compiler-registration-replace-");
  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
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

  const topology = createTopology(
    fixture.root,
    changes,
    errors,
    undefined,
    openFileWatch,
  );
  try {
    const sharedTime = new Date("2020-01-02T03:04:05.000Z");
    fs.utimesSync(fixture.source, sharedTime, sharedTime);
    topology.refresh(false);
    const replacement = path.join(fixture.root, "src", "main.next.ts");
    fs.copyFileSync(fixture.source, replacement);
    fs.utimesSync(replacement, sharedTime, sharedTime);
    assert.notEqual(
      fs.statSync(replacement).ino,
      fs.statSync(fixture.source).ino,
      "the replacement did not create a distinct physical owner",
    );
    fs.renameSync(replacement, fixture.source);
    await Promise.resolve();

    const sourceRegistrations = registrations.filter(
      ({ location }) => location === fixture.physicalSource,
    );
    assert.equal(
      sourceRegistrations.length,
      2,
      "the atomic replacement retained its old per-file watcher",
    );
    assert.equal(sourceRegistrations[0]?.watcher.closeCount, 1);
    assert.deepEqual(
      changes,
      [],
      "an identical replacement invented a compiler content change",
    );

    fs.writeFileSync(fixture.source, "export const value = 3000;\n", "utf8");
    sourceRegistrations[1]?.listener("change", path.basename(fixture.source));
    await Promise.resolve();

    assert.deepEqual(changes, [
      { kind: "compiler", path: fixture.reportedSource },
    ]);
    assert.deepEqual(errors, []);
  } finally {
    topology.close();
  }
  assert.ok(
    registrations.every(({ watcher }) => watcher.closeCount === 1),
    "close did not drain every replacement watcher",
  );
}

async function verifyFileRearmDoesNotRepeatCompilerRefresh(): Promise<void> {
  const fixture = createFixture("ttsc-watch-compiler-registration-error-");
  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  const registrations: Array<{
    location: string;
    watcher: FakeWatcher;
  }> = [];

  const openFileWatch = ((location: fs.PathLike) => {
    const watcher = new FakeWatcher();
    registrations.push({
      location: fs.realpathSync.native(location),
      watcher,
    });
    return watcher as unknown as fs.FSWatcher;
  }) as typeof fs.watch;

  const topology = createTopology(
    fixture.root,
    changes,
    errors,
    undefined,
    openFileWatch,
  );
  try {
    topology.refresh(false);
    const replacement = path.join(fixture.root, "src", "main.next.ts");
    fs.writeFileSync(replacement, "export const value = 200;\n", "utf8");
    fs.renameSync(replacement, fixture.source);
    fs.rmSync(fixture.config);
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(
      changes.filter(({ kind }) => kind === "config").length,
      1,
      "a file-owner rearm repeated the missing-config notification",
    );
    assert.equal(
      changes.filter(({ kind }) => kind === "compiler").length,
      1,
      "the replaced source was not reported exactly once",
    );
    assert.equal(
      errors.length,
      1,
      "a file-owner rearm repeated the failed compiler refresh",
    );
    assert.equal(
      registrations.filter(
        ({ location }) => location === fixture.physicalSource,
      ).length,
      2,
      "the replaced source did not receive exactly one new physical owner",
    );
  } finally {
    topology.close();
  }
  assert.ok(
    registrations.every(({ watcher }) => watcher.closeCount === 1),
    "close did not drain every error-path watcher exactly once",
  );
}

async function verifyCloseCancelsReconciliation(): Promise<void> {
  const fixture = createFixture("ttsc-watch-compiler-registration-close-");
  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  const watchers: FakeWatcher[] = [];

  const openFileWatch = (() => {
    const watcher = new FakeWatcher();
    watchers.push(watcher);
    return watcher as unknown as fs.FSWatcher;
  }) as typeof fs.watch;

  const topology = createTopology(
    fixture.root,
    changes,
    errors,
    undefined,
    openFileWatch,
  );
  try {
    topology.refresh(false);
    topology.close();
    fs.rmSync(fixture.config);
    await Promise.resolve();

    assert.deepEqual(changes, []);
    assert.deepEqual(errors, []);
  } finally {
    topology.close();
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
  physicalSource: string;
  reportedConfig: string;
  reportedSource: string;
  root: string;
  source: string;
} {
  const root = TestProject.tmpdir(prefix);
  const source = path.join(root, "src", "main.ts");
  const config = path.join(root, "tsconfig.json");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "export const value = 1;\n", "utf8");
  fs.writeFileSync(config, JSON.stringify(configJson), "utf8");
  // Author the same declared/physical spelling as the native boundary:
  // Windows retains the declared 8.3 spelling returned by the temp-directory
  // API. Registration is physical on every platform; notification follows the
  // compiler topology's spelling.
  compilerMembership.set(root, [
    process.platform === "win32" ? source : fs.realpathSync.native(source),
  ]);
  return {
    config,
    physicalSource: fs.realpathSync.native(source),
    reportedConfig:
      process.platform === "win32" ? config : fs.realpathSync.native(config),
    reportedSource:
      process.platform === "win32" ? source : fs.realpathSync.native(source),
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
  openFileWatch: typeof fs.watch = fs.watch,
  readDirectory: typeof fs.readdirSync = fs.readdirSync,
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
    // Every directory watch goes through the explicitly supplied subscription operation.
    (location, recursive, listener) =>
      watchDirectoryThroughFsWatch(
        location,
        recursive,
        listener,
        openFileWatch,
      ),
    openFileWatch,
    readDirectory,
    () => {
      const inputs = compilerMembership.get(root);
      assert.ok(inputs, "the case did not author compiler membership");
      return inputs;
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
