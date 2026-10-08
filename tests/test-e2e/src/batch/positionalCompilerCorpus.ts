import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { WatchSession } from "../internal/ttsc/internal/watch";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Verifies installed positional requests share config, cache and public output
 * authority across one-shot commands and a response-reloading watch.
 *
 * The upfront island borrows the prepared graph's complete native contributor
 * composition. Its own reporting destinations prevent these requests from
 * overwriting another actor's observations. Normal source/tool/cache witnesses
 * must establish adoption; no executable is copied or cache entry fabricated.
 *
 * 1. Contrast response B, a later visible A and missing initial configuration.
 * 2. Require actual public copies and successful quiet/verbose presentations,
 *    explicit-root containment, failed-copy refusal and warm cache adoption.
 * 3. Reuse one installed watch for source and response edits, then join its
 *    actual nonce-bound close before restoring any shared input bytes.
 *
 * @evidence contracts/testing.md#behavioral-verification Real installed ttsc commands require selected B summaries, transformed marker100 and the single public JSX path, contrast default/explicit quiet with verbose, and retain analysis and failed-copy absence. Actual binary bytes/mtime and absent competing compiled-plugin cache distinguish preserved relative cache selection from a discarded field. Independent nested ttsx invocations may use inherited TTSC_CACHE_DIR for transient runtime generations. One installed watch retains native transformation after a source edit and stops public emission after response selection returns to A.
 * @evidence contracts/testing.md#independent-expectations Static A/B configurations independently set noEmit and products-a/products-b; the authored marker0 must become the existing native probe's literal100. Relative/absolute explicit roots name view.jsx directly, and the failed string-to-number assignment requires TS2322 without a public copy. No product result supplies another request's expected output.
 * @evidence contracts/testing.md#distinguishing-cases Safe later B supersedes missing A; later visible A supersedes B. Default/true quiet contrast with verbose/false quiet; emitting and analysis requests share the same private native pipeline. Parent-cwd source paths contrast with contained roots, and successful copies contrast with real type-check failure. Response and source edits share one immutable watch argv.
 * @evidence contracts/testing.md#execution-ownership The selected Runtime batch calls this corpus after its existing receipt assertions. It uses that batch's installed SDK, upfront static island and existing native source/cache. Eleven one-shot requests and one watch with source/response transitions are real additional work; nested native checks, showConfig queries and cache validation are not counted as one Program or zero preparation.
 * @evidence contracts/e2e.md#necessary-boundary Pure selector, path-planner and recorded subscription units cannot establish installed CLI request construction, native provenance, actual public copying/reporting, selected cache adoption or IPC watch reload and shutdown.
 * @evidence contracts/e2e.md#shared-execution One installation and the original complete contributor set serve every request. The source/tool/cache owner decides actual reuse; byte/mtime and build-log controls require adoption rather than assuming it. Different visible arguments require separate CLI lifetimes, while source and response transitions share one watch. Portable environment/default selector tables remain in direct units rather than new cold native preparations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Copied A/B/source/response inputs and the automatic package reporting fields are restored only after original command retirement and nonce-bound actual watch close. Reporting paths are isolated, while automatic native context rows remain in the original ledger after earlier actor assertions. Unknown closure retains the shared workspace and blocks restoration. Exact owned product/telemetry directories are removed only after join; the shared cache is neither copied nor deleted.
 * @evidence contracts/e2e.md#preserved-coverage Transfers the new legacy positional selection/summary/containment/failed-copy and explicit-cache adoption connections into the actually selected Runtime owner. The original inactive legacy corpus is not claimed as normal CI enrollment. Detailed aliases, encodings, resets, multiple parents, module suffixes, links and cross-volume geometry retain their maintained source-unit owners; env/default selector policy does not require duplicate native hosts here.
 */
export async function positionalCompilerCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/positional-compiler");
  const driver = path.join(root, "driver");
  const source = path.join(root, "src/view.tsx");
  const response = path.join(root, "selector.rsp");
  const configurations = ["selected-a.json", "selected-b.json"].map((name) =>
    path.join(root, name),
  );
  const automaticFile = path.join(
    workspace.root,
    "packages/batch-auto-discovery/package.json",
  );
  const originals = new Map(
    [...configurations, source, response, automaticFile].map((file) => [
      file,
      fs.readFileSync(file),
    ]),
  );
  const telemetry = path.join(root, "telemetry");
  const rootConfig = JSON.parse(
    fs.readFileSync(path.join(workspace.root, "tsconfig.json"), "utf8"),
  );
  const reporting = { reportedFiles: [source], reportedDependencies: [] };
  const entries = rootConfig.compilerOptions.plugins.map(
    (entry: Record<string, unknown>, index: number) => {
      const selected = { ...entry };
      for (const field of ["transform", "config", "configFile"])
        if (typeof selected[field] === "string" && selected[field].startsWith("."))
          selected[field] = path.resolve(workspace.root, selected[field]);
      for (const field of [
        "runLog",
        "contextReceipt",
        "configPathReceipt",
        "pathsReceipt",
        "casePolicyReceipt",
        "contextProbe",
        "esmContextProbe",
      ])
        if (Object.hasOwn(selected, field))
          selected[field] = path.join(telemetry, `${index}-${field}.json`);
      if (Object.hasOwn(selected, "reportedFiles"))
        Object.assign(selected, reporting);
      return selected;
    },
  );
  const automatic = JSON.parse(originals.get(automaticFile)!.toString("utf8"));
  Object.assign(automatic.ttsc.plugin, reporting);
  const selectedCache = path.relative(root, workspace.cache);
  const competingCache = path.join(root, "competing-cache");
  const competingPluginCache = path.join(competingCache, "plugins");
  const launcher = path.join(path.dirname(workspace.installedTtsx), "ttsc.js");
  const env = { ...process.env, TTSC_CACHE_DIR: competingCache };
  const failures: unknown[] = [];
  let joined = true;
  const capture = async (name: string, body: () => void | Promise<void>) => {
    try {
      await body();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const binaries = () => {
    const directory = path.join(workspace.cache, "plugins");
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.includes(".lock"))
      .flatMap((entry) => {
        const file = path.join(
          directory,
          entry.name,
          process.platform === "win32" ? "plugin.exe" : "plugin",
        );
        if (!fs.existsSync(file)) return [];
        return [{
          file,
          mtimeMs: fs.statSync(file).mtimeMs,
          hash: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
        }];
      })
      .sort((left, right) => left.file.localeCompare(right.file));
  };
  const beforeBinaries = binaries();
  assert.ok(
    beforeBinaries.length > 0,
    "the existing batch must have prepared native artifacts",
  );
  const run = (cwd: string, args: readonly string[]) => {
    if (!joined) throw new Error("positional input ownership is unresolved");
    const result = E2eProcessTrace.spawnSync(process.execPath, [launcher, ...args], {
      cwd,
      env,
      encoding: "utf8",
      windowsHide: true,
    });
    if (!isOrdinarilyClosedReadonlyLauncher(result)) {
      joined = false;
      BatchWorkspace.retain("positional launcher did not close ordinarily");
      throw new Error("positional launcher did not close ordinarily", {
        cause: result.error,
      });
    }
    try {
      process.kill(result.pid, 0);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ESRCH") return result;
      joined = false;
      BatchWorkspace.retain("positional launcher departure is unresolved");
      throw cause;
    }
    joined = false;
    BatchWorkspace.retain("positional launcher is still live");
    throw new Error("positional launcher is still live");
  };
  const copied = path.join(root, "products-b/view.jsx");
  const outputRoots = [
    "products-a",
    "products-b",
    "telemetry",
    "driver/contained",
    "driver/absolute",
    "driver/failed",
  ].map((name) => path.join(root, name));
  try {
    fs.mkdirSync(telemetry);
    for (const file of configurations) {
      const config = JSON.parse(originals.get(file)!.toString("utf8"));
      config.compilerOptions.plugins = entries;
      fs.writeFileSync(file, JSON.stringify(config));
    }
    fs.writeFileSync(automaticFile, JSON.stringify(automatic));
    for (const [name, args, verbose, emit] of [
      ["default quiet", [], false, true],
      ["missing locator", [], false, true],
      ["verbose", ["--verbose"], true, true],
      ["quiet false", ["--quiet", "false"], true, true],
      ["quiet true", ["--quiet"], false, true],
      ["explicit analysis", ["--verbose", "--emit", "false"], true, false],
      ["later A", ["--verbose", "-p", "selected-a.json"], true, false],
      ["check", ["check", "--verbose", "--noEmit"], true, false],
    ] as const) {
      await capture("positional selection/cache/presentation: " + name, () => {
        if (!joined) throw new Error("positional input ownership is unresolved");
        fs.rmSync(copied, { force: true });
        const prefix = args[0] === "check" ? ["check"] : [];
        const extra = args[0] === "check" ? args.slice(1) : args;
        const result = run(driver, [
          ...prefix,
          "--cwd", root,
          "--cache-dir", selectedCache,
          "-p", name === "missing locator" ? "missing.json" : "selected-a.json",
          "@selector.rsp",
          ...extra,
          "src/view.tsx",
        ]);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.equal(fs.existsSync(copied), emit);
        assert.equal(fs.existsSync(path.join(root, "products-a/view.jsx")), false);
        assert.doesNotMatch(result.stdout, /ttsc-single-file-/);
        if (emit) {
          assert.match(
            fs.readFileSync(copied, "utf8"),
            /__TTSC_OWN_MARKER__\s*=\s*100/,
          );
          assert.match(result.stdout, /products-b[/\\]view\.jsx/);
        }
        if (verbose) {
          assert.match(result.stdout, /\/\/ ttsc: tsconfig=/);
          assert.ok(result.stdout.includes(
            name === "later A" ? "selected-a.json" : "selected-b.json",
          ));
          assert.ok(result.stdout.includes("emit=" + emit));
          if (emit) assert.match(result.stdout, /emitted=1 files/);
          else assert.doesNotMatch(result.stdout, /emitted=/);
        } else assert.doesNotMatch(result.stdout, /\/\/ ttsc:/);
        assert.equal(
          fs.existsSync(competingPluginCache),
          false,
          "explicit --cache-dir must own the compiled-plugin cache",
        );
        assert.doesNotMatch(result.stderr, /building source plugin/);
        assert.deepEqual(binaries(), beforeBinaries);
      });
    }
    for (const outDir of ["contained", path.join(driver, "absolute")])
      await capture("explicit destination contains parent source: " + outDir, () => {
        const result = run(driver, [
          "--cwd", driver,
          "--cache-dir", workspace.cache,
          "-p", "../selected-b.json",
          "--outDir", outDir,
          "../src/view.tsx",
        ]);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(
          fs.readFileSync(path.resolve(driver, outDir, "view.jsx"), "utf8"),
          /__TTSC_OWN_MARKER__\s*=\s*100/,
        );
        assert.equal(fs.existsSync(path.join(driver, "src/view.jsx")), false);
        assert.equal(fs.existsSync(path.join(root, "src/view.jsx")), false);
      });
    await capture("failed positional copy remains absent", () => {
      if (!joined) throw new Error("positional input ownership is unresolved");
      try {
        fs.writeFileSync(source, 'export const value: number = "invalid";\n');
        const result = run(driver, [
          "--cwd", driver,
          "--cache-dir", workspace.cache,
          "-p", "../selected-b.json",
          "--outDir", "failed",
          "../src/view.tsx",
        ]);
        assert.notEqual(result.status, 0);
        assert.match(result.stdout + result.stderr, /TS2322/);
        assert.doesNotMatch(result.stdout, /\/\/ ttsc:/);
        assert.equal(fs.existsSync(path.join(driver, "failed/view.jsx")), false);
      } finally {
        if (joined) fs.writeFileSync(source, originals.get(source)!);
      }
    });
    if (joined) {
      fs.rmSync(copied, { force: true });
      joined = false;
      const watch = new WatchSession(root, {
        launcher,
        args: [
          "--cache-dir", selectedCache,
          "-p", "selected-a.json",
          "@selector.rsp", "--verbose", "src/view.tsx",
        ],
        env,
        ownershipRoot: workspace.root,
      });
      try {
        const count = () => (
          watch.transcript().match(/\[ttsc\] watch build (?:complete|failed)/g) ?? []
        ).length;
        let initialReady = false;
        await capture("installed positional watch initial B publication", async () => {
          await watch.waitForBuilds(1);
          assert.match(watch.transcript(), /\[ttsc\] watch build complete/);
          assert.match(
            fs.readFileSync(copied, "utf8"),
            /__TTSC_OWN_MARKER__\s*=\s*100/,
          );
          await watch.waitForSettled();
          await watch.waitForQuiet();
          initialReady = true;
        });
        await capture("installed positional watch source reload", async () => {
          if (!initialReady)
            throw new Error("source reload blocked by initial publication failure");
          const completed = count();
          fs.appendFileSync(source, "\nexport const later = 2;\n");
          await watch.waitForBuilds(completed + 1);
          await watch.waitForSettled();
          assert.match(fs.readFileSync(copied, "utf8"), /later\s*=\s*2/);
          assert.match(
            fs.readFileSync(copied, "utf8"),
            /__TTSC_OWN_MARKER__\s*=\s*100/,
          );
        });
        await capture("installed positional watch response reload to analysis A", async () => {
          if (!initialReady)
            throw new Error("response reload blocked by initial publication failure");
          await watch.waitForSettled();
          await watch.waitForQuiet();
          fs.rmSync(copied, { force: true });
          const completed = count();
          const beforeResponse = watch.transcript().length;
          fs.writeFileSync(response, "--project selected-a.json\n");
          await watch.waitForBuilds(completed + 1);
          await watch.waitForSettled();
          const responseBuild = watch.transcript().slice(beforeResponse);
          assert.match(responseBuild, /\[ttsc\] watch build complete/);
          assert.doesNotMatch(responseBuild, /\[ttsc\] watch build failed/);
          assert.equal(fs.existsSync(copied), false);
          assert.equal(fs.existsSync(path.join(root, "products-a/view.jsx")), false);
          assert.doesNotMatch(watch.transcript(), /\/\/ ttsc:|building source plugin/);
          assert.equal(
            fs.existsSync(competingPluginCache),
            false,
            "explicit --cache-dir must own the compiled-plugin cache",
          );
          assert.deepEqual(binaries(), beforeBinaries);
        });
      } finally {
        await capture("installed positional watch owned close", async () => {
          await watch.close();
          joined = true;
          assert.deepEqual(watch.exitResult(), { code: 0, signal: null });
        });
      }
    }
  } finally {
    if (joined) {
      for (const [file, bytes] of originals)
        await capture("restore positional input " + file, () => {
          try {
            fs.writeFileSync(file, bytes);
            assert.deepEqual(fs.readFileSync(file), bytes);
          } catch (cause) {
            BatchWorkspace.retain("positional input restoration failed");
            throw cause;
          }
        });
      for (const directory of outputRoots)
        await capture("remove joined positional products " + directory, () => {
          const relative = path.relative(root, directory);
          assert.ok(
            relative !== "" &&
              relative !== ".." &&
              !relative.startsWith(".." + path.sep) &&
              !path.isAbsolute(relative),
          );
          try {
            fs.rmSync(directory, { recursive: true, force: true });
          } catch (cause) {
            BatchWorkspace.retain("positional product cleanup failed");
            throw cause;
          }
        });
    } else BatchWorkspace.retain("positional inputs remain owned by unresolved launcher");
  }
  if (failures.length)
    throw new AggregateError(failures, "installed positional compiler boundaries failed");
}
