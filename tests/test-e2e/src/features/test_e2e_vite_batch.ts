import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { RollupOutput, RollupWatcher } from "rollup";
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
 * @evidence contracts/testing.md#execution-ownership The selected batch calls build once with watch enabled. Three input states reuse that host and producer, with their actual native revision costs retained; no legacy Vite, Rollup or profile function is invoked. The generateBundle observer reads each actual output without generating it a second time. One additional actual Node broker process serves the consolidated native readiness/drain/root-gap corpus in a separate cache subtree; independent broker and Vite failures are both collected.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite and Rollup must load the emitted adapter, native source delivery and output graph. Direct cache or hook policy units cannot prove this assembly.
 * @evidence contracts/e2e.md#shared-execution One consumer graph, producer cache and one Vite/Rollup host serve all661 independent value assertions in initial, fallback and restored record states; no per-row preparation or host remains. Declaration and runtime source edits request necessary new native generations from that same host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity write:false prevents bundle publication. Only this project's record coordinate is blocked, with original bytes held outside the project; source and fallback bytes restore after supported watcher closure. A failed close retains the epoch rather than modifying live inputs. Ambient NODE_ENV and native-cache selection restore only after closure.
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
  const broker = test_watch_broker_hears_what_follows_ready(brokerRoot).catch(
    (error: unknown) => {
      combinedFailures.push(error);
    },
  );
  const nativeInputWatch =
    test_vite_compiler_watch_tracks_subscription_and_alias_boundaries({
      root: path.join(workspace.root, "tools/native-vite-watch"),
      externalRoot: path.join(workspace.root, "tools/native-vite-external"),
      retain: BatchWorkspace.retain,
    }).catch((error: unknown) => {
      combinedFailures.push(error);
    });
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
    const heldPrimary = path.join(
      workspace.cache,
      "vite-held-primary-record.json",
    );
    assert.equal(fs.existsSync(heldPrimary), false);
    let primaryHeld = false;
    const generations: { output: RollupOutput; watchFiles: string[] }[] = [];
    let generated: { output: RollupOutput; watchFiles: string[] } | undefined;
    const failures: unknown[] = [];
    const captures = new Set<Promise<void>>();
    try {
      const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
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
          adapter({
            plugins: JSON.parse(
              fs.readFileSync(
                path.join(workspace.root, "tsconfig.json"),
                "utf8",
              ),
            ).compilerOptions.plugins.map((entry: Record<string, unknown>) =>
              entry.name === "native-order-prefix"
                ? { ...entry, prefix: "d:" }
                : entry,
            ),
          }),
          {
            name: "shared-record-output-observation",
            enforce: "post",
            generateBundle(_options, bundle) {
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
      watcher.on("event", (event) => {
        if (event.code === "ERROR") failures.push(event.error);
        if (event.code !== "BUNDLE_END") return;
        const capture = (async () => {
          try {
            const delivered = generated;
            generated = undefined;
            assert.ok(
              delivered,
              "the actual host must render its graph before BUNDLE_END",
            );
            phase("bundle-result-close-started", {
              generation: generations.length,
            });
            await event.result.close();
            phase("bundle-result-close-returned", {
              generation: generations.length,
            });
            generations.push(delivered);
          } catch (error) {
            failures.push(error);
          }
        })();
        captures.add(capture);
        void capture
          .catch((error) => failures.push(error))
          .finally(() => captures.delete(capture));
      });
      const nextGeneration = async (offset: number, expectedRecord: string) => {
        const deadline = Date.now() + 120_000;
        for (;;) {
          if (failures.length)
            throw new AggregateError(
              failures,
              "shared Vite record state failed",
            );
          const generation = generations
            .slice(offset)
            .find((candidate) => candidate.watchFiles.includes(expectedRecord));
          if (generation) return generation;
          assert.ok(
            Date.now() < deadline,
            "the retained host did not deliver record state " + expectedRecord,
          );
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      };
      const initial = await nextGeneration(0, primary);
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
      assert.equal(
        map.sourcesContent[map.sources.indexOf(original.source)]!.replace(
          /\r\n/g,
          "\n",
        ),
        authored,
      );
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
        initial.watchFiles.filter((file) => file === primary).length,
        1,
        "one project record reaches the actual Rollup host",
      );
      assert.equal(
        initial.watchFiles.includes(declaration),
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
      const blocked = await nextGeneration(blockedOffset, fallback);
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
      fs.rmdirSync(primary);
      fs.renameSync(heldPrimary, primary);
      primaryHeld = false;
      const restoredOffset = generations.length;
      fs.appendFileSync(
        sibling,
        "\n// sibling delivery acknowledges restored primary publication\n",
      );
      const restored = await nextGeneration(restoredOffset, primary);
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
    } finally {
      if (watcher !== undefined) {
        let closingTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          phase("watcher-close-started");
          await Promise.race([
            watcher.close(),
            new Promise<never>((_resolve, reject) => {
              closingTimer = setTimeout(
                () =>
                  reject(
                    new Error(
                      "shared Vite host closure is unobserved; mutable epoch retained",
                    ),
                  ),
                120_000,
              );
            }),
          ]);
          phase("watcher-close-returned");
          phase("close-captures-join-started", { captures: captures.size });
          await Promise.all(captures);
          phase("close-captures-join-returned");
        } finally {
          if (closingTimer !== undefined) clearTimeout(closingTimer);
        }
      }
      if (primaryHeld) {
        fs.rmdirSync(primary);
        fs.renameSync(heldPrimary, primary);
      }
      for (const [file, bytes] of originalInputs) fs.writeFileSync(file, bytes);
      if (originalFallback !== undefined)
        fs.writeFileSync(fallback, originalFallback);
      else if (fs.existsSync(fallback)) fs.unlinkSync(fallback);
      if (previousCache === undefined) delete process.env.TTSC_CACHE_DIR;
      else process.env.TTSC_CACHE_DIR = previousCache;
      if (previousMode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousMode;
    }
  } catch (error) {
    phase("build-corpus-threw", { error: String(error) });
    combinedFailures.push(error);
  } finally {
    phase("broker-join-started");
    await broker;
    phase("broker-join-returned");
    phase("native-input-watch-join-started");
    await nativeInputWatch;
    phase("native-input-watch-join-returned");
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
