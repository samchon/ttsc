import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import webpack from "webpack";

import { BatchWorkspace } from "../batch/BatchWorkspace";
import { bundlerCacheCorpus } from "../batch/bundlerCacheCorpus";
import { runRspackShared } from "../batch/runRspackShared";
import { originalPositionFor } from "../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../internal/unplugin/internal/source-map/positionOf";

/**
 * Verifies webpack loader transport and source-map publication in one build.
 *
 * The same immutable graph feeds this real compiler. It is closed on success
 * and failure before fixture reuse, rather than allocating a project per case.
 *
 * 1. Run one webpack compiler over the shared source graph.
 * 2. Close the actual compiler and inspect its output and map.
 * 3. Evaluate all independent values and require original API source controls.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual webpack stats must contain no errors; its real output must evaluate all661 UTF-16 values, contract42, JSON42/retained and original API source sentinels and numeric zero; native entry receipts separately verify inline prefix c: admission, and publish a nonempty source map.
 * @evidence contracts/testing.md#independent-expectations Authored source/JSON and pre-print string units supply value expectations; the independently authored src/map.ts bytes supply map identity and coordinates; the separate complete banner block must remain in generated JavaScript.
 * @evidence contracts/testing.md#distinguishing-cases One real webpack loader graph carries entity/raw/expression strings and parsed API values versus runtime-owned emit effects; a missing adapter, bad graph or missing map fails independently of bundle text length.
 * @evidence contracts/testing.md#execution-ownership This selected function owns two actual host builds: webpack once and the Rspack helper once. Both settle while the webpack lease stays live; this is not one host execution.
 * @evidence contracts/e2e.md#necessary-boundary The actual webpack loader must consume native parsed source modules and publish authored-source maps through the actual loader through real bundle assembly; pure mapper units do not prove this route.
 * @evidence contracts/e2e.md#shared-execution Both host consumers share the existing cache keyed by identical options while the webpack owner remains live; the actual native ApplyProgram receipt must increase once. No source-case loop invokes a compiler or creates a fixture.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Outputs have a dedicated directory outside src and do not enter source discovery. Actual close is awaited in finally; failure keeps inputs under their shared owner and cache selection restores.
 * @evidence contracts/e2e.md#preserved-coverage Keeps the real webpack adapter, restored authored-source map and separate complete-banner assertion alongside the common value/utility assertions. It does not infer Rspack/Turbopack or historical rebuild/invalidation coverage from one webpack output.
 */
export async function test_e2e_webpack_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const combinedFailures: unknown[] = [];
  try {
  const configReceiptOffset =
    BatchWorkspace.readConfigPathReceipts(workspace).length;
  const previous = process.env.TTSC_CACHE_DIR;
  process.env.TTSC_CACHE_DIR = workspace.cache;
  let compiler: webpack.Compiler | undefined;
  try {
    const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("webpack");
    const directory = path.join(workspace.root, "webpack-output");
    compiler = webpack({
      context: workspace.root,
      entry: {
        corpus: path.join(workspace.root, "src/bundle.ts"),
        map: path.join(workspace.root, "src/map.ts"),
      },
      mode: "development",
      devtool: "source-map",
      module: {
        rules: [
          { test: /\.tsx?$/, type: "javascript/auto" },
          {
            test: /\.tsx?$/,
            exclude: /[\\/]map\.ts$/,
            use: [{ loader: path.join(workspace.root, "typed-loader.cjs") }],
          },
        ],
      },
      output: { path: directory, filename: "[name].js" },
      plugins: [
        adapter({
          project: path.join(workspace.projectAlias, "tsconfig.json"),
          compilerOptions: {
            plugins: JSON.parse(
              fs.readFileSync(
                path.join(workspace.root, "tsconfig.json"),
                "utf8",
              ),
            ).compilerOptions.plugins.map((entry: Record<string, unknown>) =>
              entry.name === "shared-real-program-probe"
                ? { ...entry, prefix: "c:" }
                : entry,
            ),
          },
        }),
      ],
      resolve: {
        alias: { "@data": path.join(workspace.root, "src/data.json") },
        extensions: [".tsx", ".ts", ".js", ".json"],
      },
    });
    const baseline = fs.existsSync(workspace.programRunLog)
      ? fs.statSync(workspace.programRunLog).size
      : 0;
    const receiptOffset = BatchWorkspace.readContextReceipts(workspace).length;
    const paired = runRspackShared(workspace);
    const webpackChecks = (async () => {
      const owned = compiler!;
      const stats = await new Promise<webpack.Stats>((resolve, reject) => {
        owned.run((error, result) =>
          error
            ? reject(error)
            : result
              ? resolve(result)
              : reject(new Error("webpack returned no stats")),
        );
      });
      assert.equal(stats.hasErrors(), false, stats.toString({ errors: true }));
      const code = fs.readFileSync(path.join(directory, "corpus.js"), "utf8");
      BatchWorkspace.assertResult(
        BatchWorkspace.readBundle(code),
        workspace.expected,
      );
      const map = JSON.parse(
        fs.readFileSync(path.join(directory, "map.js.map"), "utf8"),
      );
      assert.equal(map.version, 3);
      assert.ok(
        map.sources.some((source: string) => source.includes("map.ts")),
      );
      assert.ok(map.mappings.length > 0);
      const marker = '"authored-marker"';
      const generated = positionOf(
        fs.readFileSync(path.join(directory, "map.js"), "utf8"),
        marker,
      );
      const original = originalPositionFor(
        map,
        generated.line,
        generated.column,
      );
      assert.ok(original);
      assert.match(original.source, /map\.ts$/);
      const deliveredSource = fs
        .readFileSync(path.join(workspace.root, "src/map.ts"), "utf8")
        .replace(/\r\n/g, "\n");
      const mappedSourceIndex = map.sources.indexOf(original.source);
      assert.equal(
        map.sourcesContent[mappedSourceIndex].replace(/\r\n/g, "\n"),
        deliveredSource,
        "the restored bundler map describes the independently authored source",
      );
      assert.deepEqual(
        { line: original.line, column: original.column },
        positionOf(deliveredSource, marker),
      );
      assert.equal(
        original.line,
        0,
        "the authored marker begins on the original first line",
      );
      const banner = fs
        .readFileSync(
          path.join(workspace.root, "expected-map-source.txt"),
          "utf8",
        )
        .replace(/\r\n/g, "\n")
        .split("export const value")[0]!;
      assert.ok(
        fs
          .readFileSync(path.join(directory, "map.js"), "utf8")
          .replace(/\r\n/g, "\n")
          .includes(banner),
        "the generated module preserves the full configured banner independently of authored map provenance",
      );
    })();
    const outcomes = await Promise.allSettled([webpackChecks, paired]);
    const failures = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected",
    );
    if (failures.length !== 0)
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        "shared webpack/rspack deliveries failed",
      );
    assert.equal(
      fs.statSync(workspace.programRunLog).size - baseline,
      1,
      "one actual native Program serves both retained compiler leases",
    );
    BatchWorkspace.assertContextReceipts(
      BatchWorkspace.readContextReceipts(workspace).slice(receiptOffset),
      "c:",
    );
    const configReceipts =
      BatchWorkspace.readConfigPathReceipts(workspace).slice(
        configReceiptOffset,
      );
    assert.equal(
      configReceipts.length,
      1,
      "both retained compiler owners must share the actual linked-project delivery",
    );
    const receipt = configReceipts[0]!;
    const physicalConfig = fs.realpathSync.native(
      path.join(workspace.root, "config/banner.config.json"),
    );
    assert.equal(receipt.name, "shared-real-program-probe");
    assert.equal(receipt.config, physicalConfig);
    assert.equal(receipt.configFile, physicalConfig);
    assert.equal(path.isAbsolute(String(receipt.tsconfig)), true);
    assert.equal(
      fs.realpathSync.native(String(receipt.cwd)),
    fs.realpathSync.native(workspace.root),
    );
  } finally {
    try {
      if (compiler !== undefined) {
        const owned = compiler;
        try {
          await new Promise<void>((resolve, reject) =>
            owned.close((error) => (error ? reject(error) : resolve())),
          );
        } catch (error) {
          BatchWorkspace.retain("shared webpack owner closure remained unresolved");
          throw error;
        }
      }
    } finally {
      if (previous === undefined) delete process.env.TTSC_CACHE_DIR;
      else process.env.TTSC_CACHE_DIR = previous;
    }
  }
  } catch (error) { combinedFailures.push(error); }
  try { await BatchWorkspace.open(); await bundlerCacheCorpus(workspace); }
  catch (error) { combinedFailures.push(error); }
  if (combinedFailures.length === 1) throw combinedFailures[0];
  if (combinedFailures.length > 1) throw new AggregateError(combinedFailures, "webpack/Rspack and cache frontier failures");
}
