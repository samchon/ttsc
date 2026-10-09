import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { RollupOutput, RollupWatcher } from "rollup";
import { type ITtscProjectPluginConfig, TtscCompiler } from "ttsc";
import { build } from "vite";

import { fallbackToolDirectory } from "../../../../packages/unplugin/lib/core/bridge/fallbackToolDirectory.mjs";
import { hostToolDirectory } from "../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.mjs";
import { projectRecordFile } from "../../../../packages/unplugin/lib/core/bridge/projectRecordFile.mjs";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { waitFor } from "../../../utils/src/internal/waitFor";
import { originalPositionFor } from "../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../internal/unplugin/internal/source-map/positionOf";
import { BatchWorkspace } from "./BatchWorkspace";

/** Concrete mutation receipts; missing identity never authorizes restoration. */
export interface ViteRecordTransition {
  /** Original regular file before its exclusive move to heldPrimary. */
  primary?: { bytes: string; identity: { realpath: string; dev: number; ino: number; birthtimeMs: number } };

  /** Exclusively created empty blocker, observed before later host work. */
  blocker?: { dev: number; ino: number; birthtimeMs: number };

  /** Actual blocker removal and held-file restoration both completed. */
  restored?: boolean;
}

/** The actor borrows prepared paths and values, never the preparation owner. */
export interface ViteBuildRequest {
  /** Serializable prepared paths and independent values; no archive authority. */
  workspace: Pick<BatchWorkspace.Workspace, "root" | "cache" | "contextReceipt" | "pathsReceipt" | "expected">;

  /** Exclusive ignored operational receipt, read only after original join. */
  journal: string;
}

/**
 * Verifies one retained Vite build across primary, fallback and restored records.
 *
 * Public close may precede a queued build. The original actor keeps shared
 * inputs borrowed through its real termination; the parent owns restoration.
 *
 * 1. Build the complete prepared graph once and inspect its values and map.
 * 2. Mutate declaration inputs through fallback and restored primary epochs.
 * 3. Close original outputs/watch ownership and collect late public errors.
 *
 * @evidence contracts/testing.md#behavioral-verification The same actual Vite graph supplies all 661 UTF-16 values, literal contract/JSON neighbors, map coordinates, native option paths and primary/fallback/restored publication assertions.
 * @evidence contracts/testing.md#independent-expectations Authored values and source coordinates remain independent of output; explicit alias grammar fixes native targets. Mutation epochs require actual publication after the corresponding authored change.
 * @evidence contracts/testing.md#distinguishing-cases Initial primary delivery, blocked primary with fallback, and restored primary are distinct states of one host. Public buildEnd errors remain collected even after watcher.close removes event listeners.
 * @evidence contracts/testing.md#execution-ownership One dedicated original Node actor calls the existing preparation once and build once with watch enabled. beforeExit collects queued work without forcing exit; actual native retirement is required separately by its parent.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite/Rollup load the emitted adapter and native source delivery; direct callback units cannot establish this graph or public queued-work behavior.
 * @evidence contracts/e2e.md#shared-execution The parent lends the existing prepared workspace and one retained graph serves every value and record transition. No installation, per-case producer or duplicate shared preparation is introduced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The actor records exclusive primary-file/blocker identities and never restores shared bytes. Known output/watch closes and errors are collected; natural actor termination plus the parent's native join, not close return or an idle interval, authorizes restoration.
 * @evidence contracts/e2e.md#preserved-coverage Every original value/map/path/native receipt and record assertion stays in this operation. The parent preserves independent restoration errors and unknown-lifetime retention; this operation does not certify later serve/native-watch scenarios.
 */
export async function viteBuildCorpus(request: ViteBuildRequest): Promise<void> {
  const workspace = request.workspace;
  const trace = createRequire(import.meta.url)(E2eProcessTrace.runtimePath) as {
    begin(): string | undefined;
    record(event: string, invocation: string | undefined, fields: Record<string, unknown>): void;
  };
  const invocation = trace.begin();
  const phase = (phase: string, data: Record<string, unknown> = {}): void => trace.record("vite-lifecycle", invocation, { pid: process.pid, data: { phase, ...data } });
  const receiptOffset = BatchWorkspace.readContextReceipts(workspace).length;
  const pathsReceiptOffset =
    BatchWorkspace.readPathsReceipts(workspace).length;
  process.env.TTSC_CACHE_DIR = workspace.cache;
  let watcher: RollupWatcher | undefined;
  const declaration = path.join(workspace.root, "src/console.d.ts");
  const entry = path.join(workspace.root, "src/bundle.ts");
  const sibling = path.join(workspace.root, "src/native-pipeline.ts");
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
  const heldPrimary = `${primary}.vite-held`;
  assert.equal(fs.existsSync(heldPrimary), false);
  const transition: ViteRecordTransition = {};
  const checkpoint = (): void => fs.writeFileSync(request.journal, JSON.stringify(transition));
  checkpoint();
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
    if (currentBuild !== undefined || (closingRequested && originalClose !== undefined)) return;
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
            if (error != null && !failures.includes(error)) failures.push(error);
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
        // Close requests stop watch ownership; original Node retirement still owns queued work.
        closeAtIdle();
        return;
      }
      if (event.code !== "BUNDLE_END" && event.code !== "ERROR") return;
      const ownedBuild = currentBuild;
      const capture = (async () => {
        try {
          if (event.code === "ERROR" && !failures.includes(event.error)) failures.push(event.error);
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
    const primaryStat = fs.lstatSync(primary);
    assert.equal(primaryStat.isFile() && !primaryStat.isSymbolicLink(), true);
    transition.primary = {
      bytes: primaryBefore.toString("base64"),
      identity: { realpath: fs.realpathSync.native(primary), dev: primaryStat.dev, ino: primaryStat.ino, birthtimeMs: primaryStat.birthtimeMs },
    };
    checkpoint();
    fs.renameSync(primary, heldPrimary);
    fs.mkdirSync(primary);
    const blockedStat = fs.lstatSync(primary);
    transition.blocker = { dev: blockedStat.dev, ino: blockedStat.ino, birthtimeMs: blockedStat.birthtimeMs };
    checkpoint();
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
    transition.restored = true;
    checkpoint();
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
        assert.equal(pendingBuilds.size, 0, "every observed pre-close generation reached its END boundary");
        assert.equal(captures.size, 0, "no output capture survives host close");
        if (closureFailures.length !== 0)
          throw new AggregateError(closureFailures, "shared Vite output closure failed");
        phase("watcher-close-returned");
        phase("close-captures-join-returned");
      } catch (error) {
        failures.push(error);
      }
    } else if (pendingBuilds.size !== 0 || captures.size !== 0) {
      failures.push(new Error("shared Vite partial initialization left an unjoined generation"));
    }
    // No source or record restoration belongs to this actor. The parent
    // requires original native retirement, including any queued post-close run.
  }
  // Observe the empty boundary only after the close operation. Queued public
  // buildEnd callbacks can still contribute genuine failures before this point.
  await once(process, "beforeExit");
  if (failures.length !== 0)
    throw new AggregateError(failures, "shared Vite execution and original closure");
}
