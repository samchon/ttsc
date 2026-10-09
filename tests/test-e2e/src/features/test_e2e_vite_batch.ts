import { TestExecutor, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspect } from "node:util";

import { fallbackToolDirectory } from "../../../../packages/unplugin/lib/core/bridge/fallbackToolDirectory.mjs";
import { hostToolDirectory } from "../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.mjs";
import { projectRecordFile } from "../../../../packages/unplugin/lib/core/bridge/projectRecordFile.mjs";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { createViteBuildControl } from "../../../utils/src/unplugin/createViteBuildControl";
import { BatchWorkspace } from "../batch/BatchWorkspace";
import { OwnedE2eEntry } from "../batch/OwnedE2eEntry";
import type { ViteBuildRequest, ViteRecordTransition } from "../batch/viteBuildCorpus";
import { viteServeCorpus } from "../batch/viteServeCorpus";
import { test_vite_compiler_watch_tracks_subscription_and_alias_boundaries } from "./unplugin/native-plugins/adapters/test_vite_compiler_watch_tracks_subscription_and_alias_boundaries";
import { test_watch_broker_hears_what_follows_ready } from "./unplugin/transform/test_watch_broker_hears_what_follows_ready";

/**
 * Verifies Vite's actual Rollup build consumes one complete transformed graph.
 *
 * One source producer supplies the JSON alias, parsed-source controls and
 * complete native JSX matrix. Every output assertion reads this build; no
 * scenario restarts it.
 *
 * 1. Start one retained Vite/Rollup watch host with the emitted adapter.
 * 2. Interpret its one IIFE graph and compare all literal values.
 * 3. Block its own primary record, deliver a changed input state through the
 *    fallback, and restore primary publication through a sibling delivery.
 *
 * @evidence contracts/testing.md#behavioral-verification One real Vite/Rollup output runs the complete source graph with contract42, JSON42/retained and661 exact UTF-16 values; actual native Program Options receipts additionally require the absolute JSON alias, root-relative typed alias's root-first target pair and the distinct find-only trailing-slash key. The emit-only effect function is not invoked by this API consumer.
 * @evidence contracts/testing.md#independent-expectations Original pre-print string inputs and authored JSON/contract literals determine expected runtime values independently of bundler output. Literal native alias keys and ordered targets come from Vite's root-first resolution and the directly owned trailing-slash grammar, not by parsing the generated wrapper back into an expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Quoted JSX entities, expression strings, raw strings and retained versus stripped effects are simultaneous members of one bundle.
 * @evidence contracts/testing.md#execution-ownership The selected batch actor calls build once with watch enabled. Three input states reuse that host and producer, with their actual native revision costs retained; no legacy Vite, Rollup or profile function is invoked. The generateBundle observer reads each actual output without generating it a second time. One additional actual Node broker process serves the consolidated native readiness/drain/root-gap corpus in a separate cache subtree. Its original IPC replies and actual termination finish before the dedicated build actor enters synchronous native preparation; independent broker and Vite failures are both collected. The retained build alone uses one dedicated original Node actor under the existing native owner, borrowing this preparation; native preparation and Program costs are unchanged.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite and Rollup must load the emitted adapter, native source delivery and output graph. Direct cache or hook policy units cannot prove this assembly.
 * @evidence contracts/e2e.md#shared-execution One consumer graph, producer cache and one Vite/Rollup host serve all661 independent value assertions in initial, fallback and restored record states; no per-row preparation or host remains. Declaration and runtime source edits request necessary new native generations from that same host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The parent owns original source/fallback bytes and requires actual original actor/native retirement plus matching mutation identities before independent restoration callbacks. Public watcher.close is separately observed and cannot certify Task.run retirement. Joined failed execution preserves its error while restoring proven inputs; unknown lifetime or record identity retains the allocation and refuses later borrowers. The operational control leaf is released only after original retirement and all restoration readers finish; unresolved control identity or removal fails independently. Parent ambient environment is unchanged; only the contained actor selects its cache/mode.
 * @evidence contracts/e2e.md#preserved-coverage Combines real Vite transform delivery, underlying Rollup assembly and actual utility/value meanings. It does not certify every original independent adapter lifecycle or mapped unit's execution.
 */
export async function test_e2e_vite_batch(): Promise<void> {
  const trace = createRequire(import.meta.url)(E2eProcessTrace.runtimePath) as {
    begin(): string | undefined;
    record(
      event: string,
      invocation: string | undefined,
      fields: Record<string, unknown>,
    ): void;
  };
  const invocation = trace.begin();
  const phase = (phase: string, data: Record<string, unknown> = {}): void =>
    trace.record("vite-lifecycle", invocation, {
      pid: process.pid,
      data: { phase, ...data },
    });
  phase("workspace-open-started");
  const workspace = await BatchWorkspace.open();
  phase("workspace-open-returned");
  const brokerRoot = path.join(workspace.cache, "watch-broker-corpus");
  fs.mkdirSync(brokerRoot, { recursive: true });
  const combinedFailures: unknown[] = [];
  // Original broker IPC finishes before the dedicated build actor begins its
  // synchronous native preparation; these lifetimes remain separately owned.
  phase("broker-started");
  await test_watch_broker_hears_what_follows_ready(
    brokerRoot,
    BatchWorkspace.retain,
  ).catch((error: unknown) => {
    combinedFailures.push(error);
  });
  phase("broker-join-returned");
  try {
    await runViteBuildActor(workspace, phase);
  } catch (error) {
    phase("build-corpus-threw", {
      error: String(error),
      detail: process.env.TTSC_E2E_TRACE
        ? inspect(error, {
            depth: 6,
            maxArrayLength: 20,
            maxStringLength: 1000,
            customInspect: false,
            getters: false,
          })
        : undefined,
    });
    combinedFailures.push(error);
  }
  await BatchWorkspace.open();
  // Both watchers observe this workspace's project membership. Their authored
  // mutations must occupy separate epochs even though they own distinct files.
  try {
    phase("native-input-watch-started");
    await test_vite_compiler_watch_tracks_subscription_and_alias_boundaries({
      root: path.join(workspace.root, "tools/native-vite-watch"),
      externalRoot: path.join(workspace.root, "tools/native-vite-external"),
      retain: BatchWorkspace.retain,
    });
    phase("native-input-watch-join-returned");
  } catch (error) {
    combinedFailures.push(error);
  }
  await BatchWorkspace.open();
  try {
    phase("serve-corpus-started");
    await viteServeCorpus(workspace);
    phase("serve-corpus-returned");
  } catch (error) {
    combinedFailures.push(error);
  }
  if (combinedFailures.length === 1) throw combinedFailures[0];
  if (combinedFailures.length > 1)
    throw new AggregateError(
      combinedFailures,
      "Vite and native broker boundaries failed",
    );
}

/**
 * Verifies borrowed Vite inputs survive until the original actor retires.
 *
 * Rollup can start queued work after close returns. Only the existing native
 * process owner releases this borrow; record restoration also needs the
 * exclusive file and directory transition identities.
 *
 * 1. Capture original source/fallback bytes and lend the prepared workspace.
 * 2. Join the original build actor and its contained descendants.
 * 3. Restore independently owned inputs, then release their operational leaf.
 *
 * Actual native retirement supplies the lifetime fence. Source and record
 * identities captured before launch authorize independent restoration; joined
 * failures preserve their causes, while unknown ownership refuses reuse.
 * The Git-ignored control leaf survives unknown ownership and is released only
 * after all restoration readers finish. The parent environment stays intact.
 */
async function runViteBuildActor(
  workspace: BatchWorkspace.Workspace,
  phase: (name: string, data?: Record<string, unknown>) => void,
): Promise<void> {
  const rootStat = fs.lstatSync(workspace.root);
  const rootIdentity = {
    realpath: fs.realpathSync.native(workspace.root),
    dev: rootStat.dev,
    ino: rootStat.ino,
    birthtimeMs: rootStat.birthtimeMs,
  };
  const originals = ["console.d.ts", "bundle.ts", "native-pipeline.ts"].map((name) => {
    const file = path.join(workspace.root, "src", name);
    const stat = fs.lstatSync(file);
    assert.equal(stat.isFile() && !stat.isSymbolicLink(), true);
    return { file, bytes: fs.readFileSync(file), dev: stat.dev, ino: stat.ino, birthtimeMs: stat.birthtimeMs };
  });
  const primary = projectRecordFile(hostToolDirectory(process.cwd()), path.join(workspace.root, "tsconfig.json"));
  const heldPrimary = `${primary}.vite-held`;
  assert.equal(fs.existsSync(heldPrimary), false);
  const fallbackRoot = fallbackToolDirectory(process.cwd());
  assert.ok(fallbackRoot);
  const fallback = projectRecordFile(fallbackRoot, path.join(workspace.root, "tsconfig.json"));
  if (fs.existsSync(fallback)) {
    const stat = fs.lstatSync(fallback);
    assert.equal(stat.isFile() && !stat.isSymbolicLink(), true);
  }
  const fallbackBytes = fs.existsSync(fallback) ? fs.readFileSync(fallback) : undefined;
  const controlParent = path.join(TestProject.WORKSPACE_ROOT, ".wiki", "unplugin-discovery-20261008");
  const controlOwner = createViteBuildControl(controlParent);
  const control = controlOwner.root;
  const requestFile = path.join(control, "request.json");
  const journal = path.join(control, "record-transition.json");
  const resultFile = path.join(control, "result.json");
  const request: ViteBuildRequest = {
    workspace: { root: workspace.root, cache: workspace.cache, contextReceipt: workspace.contextReceipt, pathsReceipt: workspace.pathsReceipt, expected: workspace.expected },
    journal,
  };
  const lifetime: { state: "joined" | "not-started" | "unknown" } = { state: "not-started" };
  const failures: unknown[] = [];
  try {
    fs.writeFileSync(requestFile, JSON.stringify(request), { flag: "wx" });
    phase("build-actor-started", { control });
    lifetime.state = "unknown";
    const result = await OwnedE2eEntry.run({
      entry: path.join(workspace.root, "tools/vite-build-worker.mjs"),
      args: [pathToFileURL(path.join(TestProject.WORKSPACE_ROOT, "tests/test-e2e/src/batch/viteBuildCorpus.ts")).href, requestFile, resultFile],
      observeRetirement: (state) => { lifetime.state = state; phase("build-actor-retirement", { state }); },
    });
    phase("build-actor-returned", { pid: result.pid, status: result.status, signal: result.signal });
    if (result.error) failures.push(result.error);
    if (fs.existsSync(resultFile)) {
      const report = JSON.parse(fs.readFileSync(resultFile, "utf8"));
      if (report.ok !== true) failures.push(new Error("shared Vite actor failed", { cause: report }));
    } else failures.push(new Error("shared Vite actor supplied no final result"));
    if (result.status !== 0 || result.signal !== null)
      failures.push(new Error("shared Vite actor terminated without success", { cause: { status: result.status, signal: result.signal } }));
  } catch (error) {
    failures.push(error);
  } finally {
    let restored = false;
    if (lifetime.state === "joined" || lifetime.state === "not-started") {
      try {
        const currentRoot = fs.lstatSync(workspace.root);
        assert.deepEqual({
          realpath: fs.realpathSync.native(workspace.root),
          dev: currentRoot.dev,
          ino: currentRoot.ino,
          birthtimeMs: currentRoot.birthtimeMs,
        }, rootIdentity);
        const restores = await TestExecutor.collectPhases([
          { name: "restore original primary record", run: () => {
            if (lifetime.state === "not-started") {
              assert.equal(fs.existsSync(journal), false);
              assert.equal(fs.existsSync(heldPrimary), false);
              return;
            }
            const transition: ViteRecordTransition = fs.existsSync(journal) ? JSON.parse(fs.readFileSync(journal, "utf8")) : {};
            if (fs.existsSync(heldPrimary)) {
              assert.ok(transition.primary, "held primary has no original identity receipt");
              const held = fs.lstatSync(heldPrimary);
              assert.equal(held.isFile() && !held.isSymbolicLink(), true);
              assert.deepEqual({ dev: held.dev, ino: held.ino, birthtimeMs: held.birthtimeMs }, {
                dev: transition.primary.identity.dev, ino: transition.primary.identity.ino, birthtimeMs: transition.primary.identity.birthtimeMs,
              });
              assert.deepEqual(fs.readFileSync(heldPrimary), Buffer.from(transition.primary.bytes, "base64"));
              if (fs.existsSync(primary)) {
                assert.ok(transition.blocker, "primary blocker identity is unknown");
                const blocker = fs.lstatSync(primary);
                assert.equal(blocker.isDirectory() && !blocker.isSymbolicLink(), true);
                assert.deepEqual({ dev: blocker.dev, ino: blocker.ino, birthtimeMs: blocker.birthtimeMs }, transition.blocker);
                fs.rmdirSync(primary);
              }
              fs.renameSync(heldPrimary, primary);
            } else if (fs.existsSync(primary)) {
              const stat = fs.lstatSync(primary);
              assert.equal(stat.isFile() && !stat.isSymbolicLink(), true, "unowned primary coordinate cannot be restored");
              if (transition.primary && !transition.restored)
                assert.deepEqual({ dev: stat.dev, ino: stat.ino, birthtimeMs: stat.birthtimeMs }, {
                  dev: transition.primary.identity.dev, ino: transition.primary.identity.ino, birthtimeMs: transition.primary.identity.birthtimeMs,
                });
            } else assert.ok(!transition.primary || transition.restored,
              "the original primary has neither an owned held file nor a completed restoration");
          } },
          ...originals.map((original) => ({ name: "restore Vite input " + original.file, run: () => {
            const stat = fs.lstatSync(original.file);
            assert.equal(stat.isFile() && !stat.isSymbolicLink(), true);
            assert.deepEqual({ dev: stat.dev, ino: stat.ino, birthtimeMs: stat.birthtimeMs }, {
              dev: original.dev, ino: original.ino, birthtimeMs: original.birthtimeMs,
            });
            if (lifetime.state === "joined") fs.writeFileSync(original.file, original.bytes);
            else assert.deepEqual(fs.readFileSync(original.file), original.bytes);
          } })),
          { name: "restore original fallback record", run: () => {
            if (fs.existsSync(fallback)) {
              const stat = fs.lstatSync(fallback);
              assert.equal(stat.isFile() && !stat.isSymbolicLink(), true);
            }
            if (lifetime.state === "not-started") {
              assert.deepEqual(fs.existsSync(fallback) ? fs.readFileSync(fallback) : undefined, fallbackBytes);
            } else if (fallbackBytes !== undefined) fs.writeFileSync(fallback, fallbackBytes);
            else if (fs.existsSync(fallback)) fs.unlinkSync(fallback);
          } },
        ]);
        for (const restore of restores)
          if (restore.status === "failed") failures.push(restore.error);
        restored = restores.every((restore) => restore.status === "returned");
        phase("build-actor-restoration-returned", { restored, lifetime: lifetime.state });
      } catch (error) {
        failures.push(error);
      }
    }
    if (!restored) {
      try { BatchWorkspace.retain("shared Vite original retirement or mutation identity is unknown"); }
      catch (error) { failures.push(error); }
    }
    try {
      controlOwner.release(lifetime.state, restored);
      phase("build-actor-control-release-returned", { control, lifetime: lifetime.state, restored });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "shared Vite execution, original retirement, restoration and control release");
}
