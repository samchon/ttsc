import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { rspack, type Compiler, type Stats } from "@rspack/core";

import { originalPositionFor } from "../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../internal/unplugin/internal/source-map/positionOf";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Verifies rspack loader transport and source-map publication in one build.
 *
 * The same immutable graph feeds this real compiler. It is closed on success
 * and failure before fixture reuse, rather than allocating a project per case.
 *
 * 1. Run one rspack compiler over the shared source graph.
 * 2. Close the actual compiler and inspect its output and map.
 * 3. Evaluate all independent values and require original API source controls.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual rspack stats must contain no errors; its real output must evaluate all661 UTF-16 values, contract42, JSON42/retained and original API source sentinels and numeric zero; native entry receipts separately verify inline prefix c: admission, and publish a nonempty source map.
 * @evidence contracts/testing.md#independent-expectations Authored source/JSON and pre-print string units supply value expectations; the native fixture source path supplies independent map-source identity.
 * @evidence contracts/testing.md#distinguishing-cases One real rspack loader graph carries entity/raw/expression strings and parsed API values versus runtime-owned emit effects; a missing adapter, bad graph or missing map fails independently of bundle text length.
 * @evidence contracts/testing.md#execution-ownership The shared build DAG calls this non-discoverable helper once while its sibling compiler lease stays live; it constructs one actual compiler and invokes run once. The finally close is lifecycle release, not another build.
 * @evidence contracts/e2e.md#necessary-boundary The actual rspack loader must consume native parsed source modules and compose maps through real bundle assembly; pure mapper units do not prove this route.
 * @evidence contracts/e2e.md#shared-execution All rows share the same prepared corpus, native artifacts and one rspack compiler. No source-case loop invokes a compiler or creates a fixture.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Outputs have a dedicated directory outside src and do not enter source discovery. Actual close is awaited in finally; failure keeps inputs under their shared owner and cache selection restores.
 * @evidence contracts/e2e.md#preserved-coverage Keeps the real rspack adapter/map route and common value/utility assertions. It does not infer Rspack/Turbopack or historical rebuild/invalidation coverage from one rspack output.
 */
export async function runRspackShared(workspace: BatchWorkspace.Workspace): Promise<void> {

  const previous = process.env.TTSC_CACHE_DIR;
  process.env.TTSC_CACHE_DIR = workspace.cache;
  let compiler: Compiler | undefined;
  try {
    const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("rspack");
    const directory = path.join(workspace.root, "rspack-output");
    compiler = rspack({
      context: workspace.root, entry: { corpus: path.join(workspace.root, "src/bundle.ts"), map: path.join(workspace.root, "src/map.ts") },
      mode: "development", devtool: "source-map",
      module: { rules: [
        { test: /\.tsx?$/, type: "javascript/auto" },
        { test: /\.tsx?$/, exclude: /[\\/]map\.ts$/, use: [{ loader: path.join(workspace.root, "typed-loader.cjs") }] },
      ] },
      output: { path: directory, filename: "[name].js" },
      plugins: [adapter({ compilerOptions: { plugins: JSON.parse(fs.readFileSync(path.join(workspace.root, "tsconfig.json"), "utf8")).compilerOptions.plugins.map((entry: Record<string, unknown>) => entry.name === "shared-real-program-probe" ? { ...entry, prefix: "c:" } : entry) } })], resolve: { alias: { "@data": path.join(workspace.root, "src/data.json") }, extensions: [".tsx", ".ts", ".js", ".json"] },
    });
    const owned = compiler;
    const stats = await new Promise<Stats>((resolve, reject) => {
      owned.run((error, result) => error ? reject(error) : result ? resolve(result) : reject(new Error("rspack returned no stats")));
    });
    assert.equal(stats.hasErrors(), false, stats.toString({ errors: true }));
    const code = fs.readFileSync(path.join(directory, "corpus.js"), "utf8");
    BatchWorkspace.assertResult(BatchWorkspace.readBundle(code), workspace.expected);
    const map = JSON.parse(fs.readFileSync(path.join(directory, "map.js.map"), "utf8"));
    assert.equal(map.version, 3);
    assert.ok(map.sources.some((source: string) => source.includes("map.ts")));
    assert.ok(map.mappings.length > 0);
    const marker = '"authored-marker"';
    const generated = positionOf(fs.readFileSync(path.join(directory, "map.js"), "utf8"), marker);
    const original = originalPositionFor(map, generated.line, generated.column);
    assert.ok(original);
    assert.match(original.source, /map\.ts$/);
    assert.deepEqual({ line: original.line, column: original.column }, positionOf(fs.readFileSync(path.join(workspace.root, "src/map.ts"), "utf8"), marker));
  } finally {
    try {
      if (compiler !== undefined) {
        const owned = compiler;
        await new Promise<void>((resolve, reject) => owned.close((error) => error ? reject(error) : resolve()));
      }
    } finally {
      if (previous === undefined) delete process.env.TTSC_CACHE_DIR;
      else process.env.TTSC_CACHE_DIR = previous;
    }
  }
}


