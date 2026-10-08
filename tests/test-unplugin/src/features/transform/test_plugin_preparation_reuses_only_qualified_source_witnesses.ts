import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  pluginSourceState,
  processPluginBuildEnvironment,
} from "ttsc/plugin-source";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { preparePluginBuildEnvironments } from "../../../../../packages/unplugin/src/core/transform/inputs/preparePluginBuildEnvironments";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import type { TtscHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/TtscHostInputValidation";
import { matchesUniversalHostInputTrees } from "../../../../../packages/unplugin/src/core/transform/validation/matchesUniversalHostInputTrees";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies resident plugin preparation shares a qualified source witness while
 * still preparing native build-environment authority for each request.
 *
 * The tree validator already accepts healthy source notifications paired with
 * the environment under which that exact state was proven. Preparation must
 * use the same premises rather than enumerate that source before every reuse.
 *
 * 1. Establish a real native source/environment proof and count source metadata
 *    work across repeated and concurrent preparation requests.
 * 2. Withdraw each source-witness premise and require direct source proof.
 * 3. Edit, rename and remove source inputs and change the native environment,
 *    requiring rejection followed by recovery from actual restored state.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Actual preparePluginBuildEnvironments and matchesUniversalHostInputTrees
 *   receive real source/environment inputs and supported metadata counters.
 *   Qualified requests require zero source queries; unavailable, dirty or
 *   mismatched witnesses require direct work, and actual mutations reject.
 * @evidence contracts/testing.md#independent-expectations
 *   Zero repeated source queries follows the existing qualified notification
 *   contract. Positive fallback counts distinguish reuse from unconditional
 *   skipping. Native provider states are setup inputs, while authored changes
 *   and their independently known reversals determine rejection and recovery.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Covers repeated/concurrent and new-epoch requests, absent/mismatched
 *   manifests, another result, failed/unverified/uncovered/non-authoritative or
 *   incomplete trackers, overlapping events/scopes, actual source edits,
 *   rename/removal, environment change, preparation failure and repair.
 * @evidence contracts/testing.md#execution-ownership
 *   The test-unplugin runner discovers this direct source unit. The existing
 *   static Go corpus is copied as an owning library input; actual native Go
 *   environment observations execute without building a compiler/plugin binary,
 *   opening a watcher, installing a consumer or starting a product host.
 *   Finally restores exact ambient GOENV/GOFLAGS and removes its private root.
 */
export async function test_plugin_preparation_reuses_only_qualified_source_witnesses(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-qualified-plugin-preparation-"),
  );
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/unplugin/test/fixtures/e2e/createMovingEnvironmentFixture/inputs-1",
    ),
    root,
  );
  const source = path.join(root, "plugin");
  const main = path.join(source, "main.go");
  const original = fs.readFileSync(main);
  const environmentFile = path.join(root, "go.env");
  const savedGoenv = process.env.GOENV;
  const savedFlags = process.env.GOFLAGS;
  process.env.GOENV = environmentFile;
  delete process.env.GOFLAGS;
  fs.writeFileSync(environmentFile, "");
  let reads = 0;
  const filesystem = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    lstat(file: string) {
      if (file.startsWith(source + path.sep)) reads += 1;
      return DEFAULT_FILESYSTEM_OPERATIONS.lstat(file);
    },
    statBigInt(file: string) {
      if (file.startsWith(source + path.sep)) reads += 1;
      return DEFAULT_FILESYSTEM_OPERATIONS.statBigInt(file);
    },
  };
  try {
    const environment = processPluginBuildEnvironment(source, true);
    const state = pluginSourceState(source);
    const result = {
      type: "success" as const,
      typescript: {},
      pluginSources: { [source]: state },
    } as TtscCachedProjectTransform["result"];
    TRANSFORM_RESULT_FILESYSTEM.set(result, filesystem);
    const tracker: TtscProjectMutationTracker = {
      changes: new Set(),
      changesOmitted: false,
      close: () => undefined,
      contentAuthoritative: true,
      covered: new Set([source]),
      failed: false,
      membershipChanged: false,
    };
    const validation: TtscHostInputValidation = {
      covered: new Set([source]),
      entries: new Map(),
      missing: new Map(),
      trees: new Map([[source, state]]),
    };
    const cached = {
      result,
      hostInputMutationTracker: tracker,
      hostInputValidation: validation,
    } as unknown as TtscCachedProjectTransform;
    assert.equal(matchesUniversalHostInputTrees(cached, validation), true);
    assert.equal(validation.treeEnvironments?.get(source), environment);

    reads = 0;
    for (let module = 0; module < 10; module += 1) {
      await preparePluginBuildEnvironments(result, filesystem, cached);
      assert.equal(matchesUniversalHostInputTrees(cached, validation), true);
    }
    assert.equal(reads, 0, "qualified sibling deliveries must reuse source proof");
    await Promise.all(
      Array.from({ length: 4 }, () =>
        preparePluginBuildEnvironments(result, filesystem, cached),
      ),
    );
    assert.equal(reads, 0, "equivalent concurrent requests retain source reuse");
    cached.deliveryEpoch = 2;
    await preparePluginBuildEnvironments(result, filesystem, cached);
    assert.equal(reads, 0, "a new epoch does not invalidate a still-qualified source witness");

    const contrasts: [string, () => void, () => void][] = [
      ["absent manifest", () => { cached.hostInputValidation = undefined; }, () => { cached.hostInputValidation = validation; }],
      ["different result", () => { cached.result = { ...result }; }, () => { cached.result = result; }],
      ["different source state", () => { validation.trees.set(source, "another state"); }, () => { validation.trees.set(source, state); }],
      ["different environment", () => { validation.treeEnvironments!.set(source, "another environment"); }, () => { validation.treeEnvironments!.set(source, environment); }],
      ["failed tracker", () => { tracker.failed = true; }, () => { tracker.failed = false; }],
      ["unverified tracker", () => { tracker.unverified = true; }, () => { tracker.unverified = false; }],
      ["omitted events", () => { tracker.changesOmitted = true; }, () => { tracker.changesOmitted = false; }],
      ["no content authority", () => { tracker.contentAuthoritative = false; }, () => { tracker.contentAuthoritative = true; }],
      ["uncovered source", () => { tracker.covered = new Set(); }, () => { tracker.covered = new Set([source]); }],
      ["unproven scope", () => { tracker.unproven = new Set([root]); }, () => { tracker.unproven = undefined; }],
      ["overlapping change", () => { tracker.changes.add(main); }, () => { tracker.changes.clear(); }],
    ];
    for (const [name, withdraw, restore] of contrasts) {
      withdraw();
      reads = 0;
      try {
        await preparePluginBuildEnvironments(result, filesystem, cached);
        assert.ok(reads > 0, `${name} must restore direct source proof`);
      } finally {
        restore();
      }
    }

    // A change during the asynchronous preparation boundary loses reuse too.
    reads = 0;
    const pending = preparePluginBuildEnvironments(result, filesystem, cached);
    tracker.changes.add(main);
    await pending;
    assert.ok(reads > 0);

    fs.appendFileSync(main, "// actual edit\n");
    await preparePluginBuildEnvironments(result, filesystem, cached);
    assert.equal(matchesUniversalHostInputTrees(cached, validation), false);
    fs.renameSync(main, main + ".renamed");
    await preparePluginBuildEnvironments(result, filesystem, cached);
    assert.equal(matchesUniversalHostInputTrees(cached, validation), false);
    fs.rmSync(main + ".renamed");
    await preparePluginBuildEnvironments(result, filesystem, cached);
    assert.equal(matchesUniversalHostInputTrees(cached, validation), false);
    fs.writeFileSync(main, original);
    processPluginBuildEnvironment(source, true);
    await preparePluginBuildEnvironments(result, filesystem, cached);
    assert.equal(matchesUniversalHostInputTrees(cached, validation), true);
    tracker.changes.clear();

    fs.writeFileSync(environmentFile, "GOFLAGS=-mod=mod\n");
    await preparePluginBuildEnvironments(result, filesystem, cached);
    assert.equal(matchesUniversalHostInputTrees(cached, validation), false);
    fs.writeFileSync(environmentFile, "");
    assert.equal(processPluginBuildEnvironment(source, true), environment);
    await preparePluginBuildEnvironments(result, filesystem, cached);
    assert.equal(matchesUniversalHostInputTrees(cached, validation), true);
    reads = 0;
    await preparePluginBuildEnvironments(result, filesystem, cached);
    assert.equal(reads, 0, "restored proof permits reuse after recovery");
  } finally {
    if (savedGoenv === undefined) delete process.env.GOENV;
    else process.env.GOENV = savedGoenv;
    if (savedFlags === undefined) delete process.env.GOFLAGS;
    else process.env.GOFLAGS = savedFlags;
    fs.rmSync(root, { recursive: true, force: true });
  }
}
