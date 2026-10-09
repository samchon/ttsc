import { waitFor } from "../../../utils/src/internal/waitFor";
import { TestExecutor, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { inspect } from "node:util";
import type { RollupOutput, RollupWatcher } from "rollup";
import { type ITtscProjectPluginConfig, TtscCompiler } from "ttsc";
import { build } from "vite";

import { fallbackToolDirectory } from "../../../../packages/unplugin/lib/core/bridge/fallbackToolDirectory.mjs";
import { hostToolDirectory } from "../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.mjs";
import { projectRecordFile } from "../../../../packages/unplugin/lib/core/bridge/projectRecordFile.mjs";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { BatchWorkspace } from "../batch/BatchWorkspace";
import { viteServeCorpus } from "../batch/viteServeCorpus";
import { originalPositionFor } from "../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../internal/unplugin/internal/source-map/positionOf";
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
 * @evidence contracts/testing.md#execution-ownership The selected batch calls build once with watch enabled. Three input states reuse that host and producer, with their actual native revision costs retained; no legacy Vite, Rollup or profile function is invoked. The generateBundle observer reads each actual output without generating it a second time. One additional actual Node broker process serves the consolidated native readiness/drain/root-gap corpus in a separate cache subtree. Its original IPC replies and actual termination finish before synchronous compiler preparation/build can block the parent event loop; independent broker and Vite failures are both collected. Sequential ownership adds no actor or Program and preserves the measured native preparation cost.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite and Rollup must load the emitted adapter, native source delivery and output graph. Direct cache or hook policy units cannot prove this assembly.
 * @evidence contracts/e2e.md#shared-execution One consumer graph, producer cache and one Vite/Rollup host serve all661 independent value assertions in initial, fallback and restored record states; no per-row preparation or host remains. Declaration and runtime source edits request necessary new native generations from that same host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity write:false prevents bundle publication. Only this project's record coordinate is blocked, with original bytes held outside the project. Build start owns each in-flight generation through its successful output close or failed result cleanup. Mutation epochs distinguish earlier admitted output from the required later state. Actual END completes admitted work and requests one original close before a queued rerun; every capture and close is awaited without an age cutoff; Rollup watcher.close alone does not join Task.run. Failed output close or unresolved partial initialization retains the exact allocation and refuses later borrowers instead of restoring live source/fallback bytes or ambient NODE_ENV/native-cache selection.
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
  // Original IPC phases must finish before this parent enters synchronous native
  // preparation or compilation; those operations cannot service ready events.
  phase("broker-started");
  await test_watch_broker_hears_what_follows_ready(
    brokerRoot,
    BatchWorkspace.retain,
  ).catch((error: unknown) => {
    combinedFailures.push(error);
  });
  phase("broker-join-returned");
  try {
    const receiptOffset = BatchWorkspace.readContextReceipts(workspace).length;
    const pathsReceiptOffset =
      BatchWorkspace.readPathsReceipts(workspace).length;
    const previousCache = process.env.TTSC_CACHE_DIR;
    const previousMode = process.env.NODE_ENV;
    process.env.TTSC_CACHE_DIR = workspace.cache;
    let watcher: RollupWatcher | undefined;
    const declaration = path.join(workspace.root, "src/console.d.ts");
    const entry = path.join(workspace.root, "src/bundle.ts");
    const sibling = path.join(workspace.root, "src/native-pipeline.ts");
    const originalInputs = new Map(
      [declaration, entry, sibling].map((file) => [
        file,
        fs.readFileSync(file),
      ]),
    );
    const primary = projectRecordFile(
      hostToolDirectory(process.cwd()),
      path.join(workspace.root, "tsconfig.json"),
    );
    const fallbackRoot = fallbackToolDirectory(process.cwd());
    assert.ok(
      fallbackRoot,
      "the existing host must have its supported owned record fallback",
    );
    const fallback = projectRecordFile(
      fallbackRoot,
      path.join(workspace.root, "tsconfig.json"),
    );
    const fallbackExisted = fs.existsSync(fallback);
    const originalFallback = fallbackExisted
      ? fs.readFileSync(fallback)
      : undefined;
    const heldPrimary = `${primary}.vite-held`;
    assert.equal(fs.existsSync(heldPrimary), false);
    let primaryHeld = false;
    let mutationEpoch = 0;
    const generations: {
      epoch: number;
      completed: Promise<void>;
      output: { output: RollupOutput["output"][number][] };
      watchFiles: string[];
    }[] = [];
    let generated:
      | {
          output: { output: RollupOutput["output"][number][] };
          watchFiles: string[];
        }
      | undefined;
    const failures: unknown[] = [];
    const captures = new Set<Promise<void>>();
    const pendingBuilds = new Set<Promise<void>>();
    const closureFailures: unknown[] = [];
    let currentBuild: { epoch: number; done: Promise<void>; finish(): void; fail(cause: unknown): void } | undefined;
    let closingRequested = false;
    let originalClose: Promise<void> | undefined;
    const closeAtIdle = (): void => {
      if (closingRequested && watcher !== undefined && currentBuild === undefined && originalClose === undefined) {
        originalClose = watcher.close();
        // Observe the same operation immediately; cleanup awaits its original promise.
        void originalClose.catch(() => undefined);
      }
    };
    const startBuild = (): void => {
      if (currentBuild !== undefined) return;
      let finish!: () => void;
      let fail!: (cause: unknown) => void;
      const done = new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
      void done.catch(() => undefined);
      currentBuild = { epoch: mutationEpoch, done, finish, fail };
      pendingBuilds.add(done);
    };
    try {
      const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
      const plugins: ITtscProjectPluginConfig[] = JSON.parse(
        fs.readFileSync(path.join(workspace.root, "tsconfig.json"), "utf8"),
      ).compilerOptions.plugins.map((entry: ITtscProjectPluginConfig) =>
        entry.name === "native-order-prefix"
          ? { ...entry, prefix: "d:" }
          : entry,
      );
      // The public preparation pays actual native build cost before watch admission; it creates no Program and does not certify later reuse.
      const preparationStarted = performance.now();
      phase("native-preparation-started", {
        projectRoot: workspace.root,
        pluginConfigDir: workspace.root,
        plugins,
        cacheDir: workspace.cache,
        environment: {
          TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY,
          TTSC_GO_BINARY: process.env.TTSC_GO_BINARY,
          TTSC_GO_CACHE_DIR: process.env.TTSC_GO_CACHE_DIR,
          GOTOOLCHAIN: process.env.GOTOOLCHAIN,
          GOOS: process.env.GOOS,
          GOARCH: process.env.GOARCH,
          GOFLAGS: process.env.GOFLAGS,
          CGO_ENABLED: process.env.CGO_ENABLED,
        },
      });
      const preparedBinaries = new TtscCompiler({
        cwd: workspace.root,
        projectRoot: workspace.root,
        pluginConfigDir: workspace.root,
        tsconfig: path.join(workspace.root, "tsconfig.json"),
        cacheDir: workspace.cache,
        env: { ...process.env },
        plugins,
      }).prepare();
      phase("native-preparation-returned", {
        elapsedMs: performance.now() - preparationStarted,
        binaries: preparedBinaries,
      });
      phase("build-started");
      const result = await build({
        root: workspace.root,
        configFile: false,
        logLevel: "silent",
        resolve: {
          alias: {
            "@data": path.join(workspace.root, "src/data.json"),
            "@typed": "/src/type-population",
            "@trail/": path.join(workspace.root, "src/type-population"),
          },
        },
        plugins: [
          adapter({ plugins }),
          {
            name: "shared-record-output-observation",
            enforce: "post",
            buildStart() {
              startBuild();
              phase("rollup-build-started");
            },
            buildEnd(error) {
              phase("rollup-build-ended", {
                error: error === undefined ? undefined : String(error),
              });
            },
            generateBundle(_options, bundle) {
              phase("rollup-output-generated");
              generated = {
                output: { output: Object.values(bundle) },
                watchFiles: this.getWatchFiles(),
              };
            },
          },
        ],
        build: {
          minify: false,
          write: false,
          sourcemap: true,
          watch: {},
          rollupOptions: {
            input: path.join(workspace.root, "src/bundle.ts"),
            output: { format: "iife", name: "SharedBoundary" },
          },
        },
      });
      phase("build-returned");
      assert.ok(
        !Array.isArray(result) && "on" in result && "close" in result,
        "one retained host must own all record states",
      );
      watcher = result as RollupWatcher;
      watcher.on("close", () => {
        if (currentBuild !== undefined) {
          const error = new Error("original Vite host closed before its admitted generation reached END");
          failures.push(error);
          currentBuild.fail(error);
        } else if (!closingRequested) {
          failures.push(new Error("original Vite host closed before required record publication"));
        }
      });
      watcher.on("event", (event) => {
        phase("rollup-watch-event", { code: event.code });
        if (event.code === "BUNDLE_START") startBuild();
        if (event.code === "END") {
          const completed = currentBuild;
          currentBuild = undefined;
          if (completed !== undefined) {
            pendingBuilds.delete(completed.done);
            completed.finish();
          }
          // This synchronous request prevents admission of a queued rerun.
          closeAtIdle();
          return;
        }
        if (event.code !== "BUNDLE_END" && event.code !== "ERROR") return;
        const ownedBuild = currentBuild;
        const capture = (async () => {
          try {
            if (event.code === "ERROR") failures.push(event.error);
            const delivered =
              event.code === "BUNDLE_END" ? generated : undefined;
            generated = undefined;
            if (event.result !== null && event.result !== undefined) {
              phase("bundle-result-close-started", {
                generation: generations.length,
              });
              try {
                await event.result.close();
              } catch (error) {
                closureFailures.push(error);
                throw error;
              }
              phase("bundle-result-close-returned", {
                generation: generations.length,
              });
            }
            if (event.code === "BUNDLE_END") {
              assert.ok(
                delivered,
                "the actual host must render its graph before BUNDLE_END",
              );
              assert.ok(ownedBuild, "a delivered output belongs to an admitted original build");
              generations.push({ ...delivered, epoch: ownedBuild.epoch, completed: ownedBuild.done });
            }
          } catch (error) {
            failures.push(error);
          }
        })();
        const tracked = capture.finally(() => captures.delete(tracked));
        captures.add(tracked);
        return tracked;
      });
      const nextGeneration = async (offset: number, expectedRecord: string, epoch: number) => {
        let selected: (typeof generations)[number] | undefined;
        await waitFor(() => {
          for (const candidate of generations.slice(offset)) {
            const matches = candidate.watchFiles.some((file) => path.resolve(file) === path.resolve(expectedRecord));
            if (!matches && candidate.epoch < epoch) continue;
            assert.ok(matches,
              "the generation admitted after this mutation must deliver record " + expectedRecord +
              " actual: " + JSON.stringify(candidate.watchFiles));
            selected = candidate;
            return true;
          }
          return false;
        }, "retained Vite record publication", {
          check: () => {
            if (failures.length !== 0) throw new AggregateError([...failures], "shared Vite record state failed");
            assert.equal(closingRequested, false, "the original watch owner closed before required publication");
          },
        });
        assert.ok(selected);
        await selected.completed;
        if (failures.length !== 0) throw new AggregateError([...failures], "shared Vite generation failed");
        return selected;
      };
      const initial = await nextGeneration(0, primary, mutationEpoch);
      const outputs = initial.output.output;
      const chunks = outputs.filter((output) => output.type === "chunk");
      assert.equal(chunks.length, 1);
      const code = chunks[0]!.code;
      BatchWorkspace.assertResult(
        BatchWorkspace.readBundle(code),
        workspace.expected,
      );
      const map = chunks[0]!.map;
      assert.ok(
        map,
        "the Rollup-backed Vite host must publish its composed map",
      );
      assert.equal(map.version, 3);
      const marker = '"map-coordinate-control"';
      const generatedPosition = positionOf(code, marker);
      const original = originalPositionFor(
        map,
        generatedPosition.line,
        generatedPosition.column,
      );
      assert.ok(
        original,
        "the generated control must map to its authored source",
      );
      assert.match(original.source, /(?:^|\/)map\.ts$/);
      const authored = fs
        .readFileSync(path.join(workspace.root, "src/map.ts"), "utf8")
        .replace(/\r\n/g, "\n");
      const sourceContent =
        map.sourcesContent?.[map.sources.indexOf(original.source)];
      assert.ok(typeof sourceContent === "string");
      assert.equal(sourceContent.replace(/\r\n/g, "\n"), authored);
      assert.deepEqual(
        { line: original.line, column: original.column },
        positionOf(authored, marker),
      );
      const nativeReceipts =
        BatchWorkspace.readContextReceipts(workspace).slice(receiptOffset);
      BatchWorkspace.assertContextReceipts(nativeReceipts, "a:", "d:", false);
      assert.equal(
        nativeReceipts.some(
          (receipt) => receipt.name === "native-auto-discovery",
        ),
        false,
        "explicit plugin override must suppress automatic dependency discovery",
      );
      const nativePaths =
        BatchWorkspace.readPathsReceipts(workspace).slice(pathsReceiptOffset);
      assert.equal(
        nativePaths.length,
        1,
        "one shared native Program observes the entire alias population",
      );
      assert.equal(nativePaths[0]!.name, "shared-real-program-probe");
      const slash = (value: string) => value.replace(/\\/g, "/");
      assert.deepEqual(nativePaths[0]!.paths?.["@data"], [
        slash(path.join(workspace.root, "src/data.json")),
      ]);
      assert.deepEqual(nativePaths[0]!.paths?.["@typed"], [
        slash(path.join(workspace.root, "src/type-population")),
        slash(path.resolve("/src/type-population")),
      ]);
      assert.deepEqual(nativePaths[0]!.paths?.["@typed/*"], [
        slash(path.join(workspace.root, "src/type-population/*")),
        slash(path.resolve("/src/type-population/*")),
      ]);
      assert.deepEqual(nativePaths[0]!.paths?.["@trail//*"], [
        slash(path.join(workspace.root, "src/type-population/*")),
      ]);
      for (const unsupportedKey of ["@trail", "@trail/", "@trail/*"])
        assert.equal(
          Object.prototype.hasOwnProperty.call(
            nativePaths[0]!.paths ?? {},
            unsupportedKey,
          ),
          false,
          "find-only trailing slash retains its independently specified grammar",
        );
      assert.ok(chunks[0]!.map, "the actual host must return a source map");
      assert.equal(
        initial.watchFiles.filter(
          (file) => path.resolve(file) === path.resolve(primary),
        ).length,
        1,
        "one project record reaches the actual Rollup host",
      );
      assert.equal(
        initial.watchFiles.some(
          (file) => path.resolve(file) === path.resolve(declaration),
        ),
        false,
        "raw compiler declarations must remain behind the record channel",
      );
      const primaryBefore = fs.readFileSync(primary);
      assert.ok(
        Object.hasOwn(
          JSON.parse(primaryBefore.toString("utf8")).inputs,
          declaration,
        ),
        "the actual written record must name the native declaration input",
      );
      const blockedOffset = generations.length;
      mutationEpoch += 1;
      fs.renameSync(primary, heldPrimary);
      primaryHeld = true;
      fs.mkdirSync(primary);
      fs.appendFileSync(
        declaration,
        "\n// shared record fallback generation\n",
      );
      fs.appendFileSync(
        entry,
        "\n// same host requests the changed declaration generation\n",
      );
      const blocked = await nextGeneration(blockedOffset, fallback, mutationEpoch);
      assert.deepEqual(
        fs.readFileSync(heldPrimary),
        primaryBefore,
        "failed primary publication must preserve the held original record bytes",
      );
      assert.equal(
        fs.statSync(primary).isDirectory(),
        true,
        "the actual primary write remains blocked",
      );
      const fallbackBytes = fs.readFileSync(fallback);
      assert.notDeepEqual(
        fallbackBytes,
        primaryBefore,
        "the fallback must publish the changed native input generation",
      );
      const blockedChunk = blocked.output.output.find(
        (output) => output.type === "chunk",
      );
      assert.ok(blockedChunk?.type === "chunk");
      BatchWorkspace.assertResult(
        BatchWorkspace.readBundle(blockedChunk.code),
        workspace.expected,
      );
      mutationEpoch += 1;
      fs.rmdirSync(primary);
      fs.renameSync(heldPrimary, primary);
      primaryHeld = false;
      const restoredOffset = generations.length;
      fs.appendFileSync(
        sibling,
        "\n// sibling delivery acknowledges restored primary publication\n",
      );
      const restored = await nextGeneration(restoredOffset, primary, mutationEpoch);
      assert.notDeepEqual(
        fs.readFileSync(primary),
        primaryBefore,
        "restored primary persistence must publish the later native input state",
      );
      const restoredChunk = restored.output.output.find(
        (output) => output.type === "chunk",
      );
      assert.ok(restoredChunk?.type === "chunk");
      BatchWorkspace.assertResult(
        BatchWorkspace.readBundle(restoredChunk.code),
        workspace.expected,
      );
      phase("captures-join-started", { captures: captures.size });
      await Promise.all(captures);
      phase("captures-join-returned");
    } catch (error) {
      failures.push(error);
    } finally {
      let safelyJoined = false;
      if (watcher !== undefined) {
        try {
          phase("watcher-close-started");
          closingRequested = true;
          closeAtIdle();
          const generationsJoined = await Promise.allSettled([...pendingBuilds]);
          closeAtIdle();
          const independentCloses = await Promise.allSettled([
            Promise.resolve().then(async () => {
              assert.ok(originalClose, "the original host close must be requested at its END boundary");
              await originalClose;
            }),
            Promise.all([...captures]),
          ]);
          const joinFailures = [...generationsJoined, ...independentCloses]
            .filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected")
            .map((outcome) => outcome.reason);
          if (joinFailures.length !== 0)
            throw new AggregateError(joinFailures, "shared Vite original generation, host and capture joins");
          assert.equal(pendingBuilds.size, 0, "no original started generation survives host close");
          assert.equal(captures.size, 0, "no output capture survives host close");
          if (closureFailures.length !== 0)
            throw new AggregateError(closureFailures, "shared Vite output closure failed");
          safelyJoined = true;
          phase("watcher-close-returned");
          phase("close-captures-join-returned");
        } catch (error) {
          failures.push(error);
        }
      } else if (pendingBuilds.size === 0 && captures.size === 0) {
        safelyJoined = true;
      } else {
        failures.push(new Error("shared Vite partial initialization left an unjoined generation"));
      }
      if (safelyJoined) {
        const restores = await TestExecutor.collectPhases([
          { name: "restore original primary record", run: () => {
            if (primaryHeld) {
              fs.rmdirSync(primary);
              fs.renameSync(heldPrimary, primary);
              primaryHeld = false;
            }
          } },
          ...[...originalInputs].map(([file, bytes]) => ({
            name: "restore Vite input " + file,
            run: () => fs.writeFileSync(file, bytes),
          })),
          { name: "restore original fallback record", run: () => {
            if (originalFallback !== undefined) fs.writeFileSync(fallback, originalFallback);
            else if (fs.existsSync(fallback)) fs.unlinkSync(fallback);
          } },
          { name: "restore native cache environment", run: () => {
            if (previousCache === undefined) delete process.env.TTSC_CACHE_DIR;
            else process.env.TTSC_CACHE_DIR = previousCache;
          } },
          { name: "restore Vite mode environment", run: () => {
            if (previousMode === undefined) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = previousMode;
          } },
        ]);
        for (const restored of restores)
          if (restored.status === "failed") failures.push(restored.error);
        safelyJoined = restores.every((restored) => restored.status === "returned");
      }
      if (!safelyJoined) {
        try { BatchWorkspace.retain("shared Vite original closure or restoration is unproved"); }
        catch (error) { failures.push(error); }
      }
    }
    if (failures.length !== 0)
      throw new AggregateError(failures, "shared Vite execution, closure and restoration");
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
