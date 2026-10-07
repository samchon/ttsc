import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the owned compiler reader participates in real watch reconciliation.
 *
 * The reader supplies membership, while the topology still resolves actual
 * inherited configurations, references and native file identities. A failed
 * listing must leave the previously acquired coverage live, and positional
 * source selection must not ask a project-membership reader at all.
 *
 * 1. Read root and referenced project membership through one explicit reader,
 *    preserving its arrays and the actual project/options arguments.
 * 2. Reconcile changed membership, then reject a listing and preserve old handles.
 * 3. Refresh a positional source without invoking the membership operation.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual WatchTopology resolves inherited config and references, requests supplied membership, reports edits of admitted source members while ignoring omitted ones, replaces that admission and propagates a listing error without retiring the prior live population. Positional inputs do not call the supplied reader and close retires all handles.
 * @evidence contracts/testing.md#independent-expectations Authored config inheritance, reference paths and explicit absolute member arrays establish expected input notifications; a deliberate reader error and actual byte transitions establish failure preservation independently of topology state. Directory coverage may observe omitted names, but does not admit them as compiler inputs.
 * @evidence contracts/testing.md#distinguishing-cases Root versus referenced projects, included versus omitted files, replacement membership, unchanged caller-owned arrays, listing failure and recovery, and positional selection distinguish acquisition from topology policy. The canonical E2E population owns native compiler listing and real observer delivery.
 * @evidence contracts/testing.md#execution-ownership This source unit calls WatchTopology with the shared recorder's supported operations and an explicit compiler-input reader. It reads real temporary configs and source files, but invokes no native compiler, artifact build, product host or OS subscription.
 */
export async function test_watch_topology_reads_compiler_inputs_through_owned_operation(): Promise<void> {
  const failures: unknown[] = [];
  for (const scenario of [verifyProjectMembership, verifyPositionalSelection]) {
    try {
      await scenario();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "owned compiler reader scenarios failed",
    );
}

async function verifyProjectMembership(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-owned-compiler-membership-"),
  );
  const child = path.join(root, "child");
  const source = path.join(root, "src", "seed.ts");
  const replacement = path.join(root, "src", "replacement.ts");
  const childSource = path.join(child, "src", "child.ts");
  for (const entry of [source, replacement, childSource]) {
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(entry, "export const value = 1;\n");
  }
  const baseConfig = path.join(root, "base.json");
  const rootConfig = path.join(root, "tsconfig.json");
  const childConfig = path.join(child, "tsconfig.json");
  fs.writeFileSync(
    baseConfig,
    JSON.stringify({ compilerOptions: { noEmit: true, strict: true } }),
  );
  fs.writeFileSync(
    rootConfig,
    JSON.stringify({
      extends: "./base.json",
      files: ["src/seed.ts"],
      references: [{ path: "./child/tsconfig.json" }],
    }),
  );
  fs.writeFileSync(
    childConfig,
    JSON.stringify({
      compilerOptions: { noEmit: true },
      files: ["src/child.ts"],
    }),
  );
  const initialMembers = [source];
  const replacementMembers = [replacement];
  const childMembers = [childSource];
  for (const members of [initialMembers, replacementMembers, childMembers])
    Object.freeze(members);
  let rootMembers = initialMembers;
  let reject = false;
  const failure = new Error("authored compiler-reader failure");
  const calls: string[] = [];
  let topologyChanges = 0;
  const changes: WatchInputChange[] = [];
  const recorder = recordWatchers(watchDirectoryThroughFsWatch);
  const options = {
    cwd: root,
    files: [],
    tsconfig: rootConfig,
    env: { TTSC_READER_OWNER: "unit" },
    passthrough: ["--skipLibCheck"],
  };
  const topology = new WatchTopology(
    options,
    {
      onError: (_location, error) => {
        throw error;
      },
      onInputChange: (change) => changes.push(change),
      onTopologyChange: () => {
        topologyChanges += 1;
      },
    },
    recorder.openDirectoryWatch,
    recorder.openFileWatch,
    fs.readdirSync,
    (project, receivedOptions) => {
      calls.push(project.path);
      assert.equal(receivedOptions, options);
      assert.equal(project.root, project.path === rootConfig ? root : child);
      if (project.path === rootConfig) {
        assert.equal(project.compilerOptions.strict, true);
        assert.equal(project.compilerOptions.noEmit, true);
        assert.ok(project.configPaths.includes(baseConfig));
        if (reject) throw failure;
        return rootMembers;
      }
      assert.equal(project.path, childConfig);
      return childMembers;
    },
  );
  let revision = 1;
  const edit = async (entry: string): Promise<void> => {
    fs.writeFileSync(entry, `export const value = ${++revision};\n`);
    deliverWatchEvent(recorder.watchers, entry, "change");
    await settleWatchEvents();
  };
  try {
    topology.refresh(false);
    assert.deepEqual(calls, [rootConfig, childConfig]);
    await settleWatchEvents();
    assert.deepEqual(changes, []);
    await edit(source);
    assert.deepEqual(changes, [{ kind: "compiler", path: source }]);
    changes.length = 0;
    await edit(childSource);
    assert.deepEqual(changes, [{ kind: "compiler", path: childSource }]);
    changes.length = 0;
    await edit(replacement);
    assert.deepEqual(changes, []);
    rootMembers = replacementMembers;
    topology.refresh(true);
    await settleWatchEvents();
    assert.equal(topologyChanges, 1);
    await edit(source);
    assert.deepEqual(changes, []);
    await edit(replacement);
    assert.deepEqual(changes, [{ kind: "compiler", path: replacement }]);
    changes.length = 0;
    const beforeFailure = recorder.watchers.filter((watcher) => watcher.active);
    reject = true;
    assert.throws(
      () => topology.refresh(true),
      (error) => error === failure,
    );
    assert.deepEqual(
      recorder.watchers.filter((watcher) => watcher.active),
      beforeFailure,
    );
    assert.equal(topologyChanges, 1);
    reject = false;
    topology.refresh(true);
    await settleWatchEvents();
    assert.equal(topologyChanges, 1);
    assert.deepEqual(initialMembers, [source]);
    assert.deepEqual(replacementMembers, [replacement]);
    assert.deepEqual(childMembers, [childSource]);
  } finally {
    topology.close();
  }
  assert.ok(recorder.watchers.every((watcher) => !watcher.active));
}

async function verifyPositionalSelection(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-owned-compiler-positional-"),
  );
  const source = path.join(root, "entry.ts");
  fs.writeFileSync(source, "export const value = 1;\n");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { noEmit: true }, files: ["entry.ts"] }),
  );
  const recorder = recordWatchers(watchDirectoryThroughFsWatch);
  const changes: WatchInputChange[] = [];
  const topology = new WatchTopology(
    { cwd: root, files: [source], tsconfig: path.join(root, "tsconfig.json") },
    {
      onError: (_location, error) => {
        throw error;
      },
      onInputChange: (change) => changes.push(change),
      onTopologyChange: () => {
        throw new Error("unchanged positional topology notified");
      },
    },
    recorder.openDirectoryWatch,
    recorder.openFileWatch,
    fs.readdirSync,
    () => {
      throw new Error("positional inputs requested project membership");
    },
  );
  try {
    topology.refresh(false);
    await settleWatchEvents();
    assert.deepEqual(changes, []);
    fs.writeFileSync(source, "export const value = 2;\n");
    deliverWatchEvent(recorder.watchers, source, "change");
    await settleWatchEvents();
    assert.deepEqual(changes, [{ kind: "compiler", path: source }]);
  } finally {
    topology.close();
  }
  assert.ok(recorder.watchers.every((watcher) => !watcher.active));
}
