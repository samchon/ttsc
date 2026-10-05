import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { build } from "vite";

import { originalPositionFor } from "../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../internal/unplugin/internal/source-map/positionOf";
import { BatchWorkspace } from "../batch/BatchWorkspace";

/**
 * Verifies Vite's actual Rollup build consumes one complete transformed graph.
 *
 * One source producer supplies the JSON alias, parsed-source controls and complete native
 * JSX matrix. Every output assertion reads this build; no scenario restarts it.
 *
 * 1. Start one real Vite build with the emitted adapter.
 * 2. Interpret its one IIFE graph and compare all literal values.
 * 3. Require original API sentinels and one JavaScript output graph.
 *
 * @evidence contracts/testing.md#behavioral-verification One real Vite/Rollup output runs the complete source graph with contract42, JSON42/retained and661 exact UTF-16 values; actual native Program Options receipts additionally require the absolute JSON alias, root-relative typed alias's root-first target pair and the distinct find-only trailing-slash key. The emit-only effect function is not invoked by this API consumer.
 * @evidence contracts/testing.md#independent-expectations Original pre-print string inputs and authored JSON/contract literals determine expected runtime values independently of bundler output. Literal native alias keys and ordered targets come from Vite's root-first resolution and the directly owned trailing-slash grammar, not by parsing the generated wrapper back into an expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Quoted JSX entities, expression strings, raw strings and retained versus stripped effects are simultaneous members of one bundle.
 * @evidence contracts/testing.md#execution-ownership The selected batch calls build once and only interprets returned output afterward; no legacy Vite, Rollup or profile function is invoked.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite and Rollup must load the emitted adapter, native source delivery and output graph. Direct cache or hook policy units cannot prove this assembly.
 * @evidence contracts/e2e.md#shared-execution One immutable consumer, producer cache and one Vite/Rollup host serve all661 value assertions and utility observations; no per-row preparation or build remains.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity write:false prevents fixture publication. The awaited one-shot build owns its supported teardown; ambient NODE_ENV and native-cache selection restore in finally before another consumer.
 * @evidence contracts/e2e.md#preserved-coverage Combines real Vite transform delivery, underlying Rollup assembly and actual utility/value meanings. It does not certify every original independent adapter lifecycle or mapped unit's execution.
 */
export async function test_e2e_vite_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const receiptOffset = BatchWorkspace.readContextReceipts(workspace).length;
  const pathsReceiptOffset = BatchWorkspace.readPathsReceipts(workspace).length;
  const previousCache = process.env.TTSC_CACHE_DIR;
  const previousMode = process.env.NODE_ENV;
  process.env.TTSC_CACHE_DIR = workspace.cache;
  try {
    const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
    const result = await build({
      root: workspace.root, configFile: false, logLevel: "silent",
      resolve: { alias: { "@data": path.join(workspace.root, "src/data.json"), "@typed": "/src/type-population", "@trail/": path.join(workspace.root, "src/type-population") } },
      plugins: [adapter({ plugins: JSON.parse(fs.readFileSync(path.join(workspace.root, "tsconfig.json"), "utf8")).compilerOptions.plugins.map((entry: Record<string, unknown>) => entry.name === "native-order-prefix" ? { ...entry, prefix: "d:" } : entry) })],
      build: { minify: false, write: false, sourcemap: true,
        rollupOptions: { input: path.join(workspace.root, "src/bundle.ts"), output: { format: "iife", name: "SharedBoundary" } } },
    });
    const outputs = Array.isArray(result) ? result.flatMap((entry) => entry.output) : "output" in result ? result.output : [];
    const chunks = outputs.filter((output) => output.type === "chunk");
    assert.equal(chunks.length, 1);
    const code = chunks[0]!.code;
    BatchWorkspace.assertResult(BatchWorkspace.readBundle(code), workspace.expected);
    const map = chunks[0]!.map;
    assert.ok(map, "the Rollup-backed Vite host must publish its composed map");
    assert.equal(map.version, 3);
    const marker = '"map-coordinate-control"';
    const generated = positionOf(code, marker);
    const original = originalPositionFor(map, generated.line, generated.column);
    assert.ok(original, "the generated control must map to its authored source");
    assert.match(original.source, /(?:^|\/)map\.ts$/);
    const authored = fs.readFileSync(path.join(workspace.root, "src/map.ts"), "utf8").replace(/\r\n/g, "\n");
    assert.equal(map.sourcesContent[map.sources.indexOf(original.source)]!.replace(/\r\n/g, "\n"), authored);
    assert.deepEqual({ line: original.line, column: original.column }, positionOf(authored, marker));
    const nativeReceipts = BatchWorkspace.readContextReceipts(workspace).slice(receiptOffset);
    BatchWorkspace.assertContextReceipts(nativeReceipts, "a:", "d:");
    assert.equal(nativeReceipts.some((receipt) => receipt.name === "native-auto-discovery"), false, "explicit plugin override must suppress automatic dependency discovery");
    const nativePaths = BatchWorkspace.readPathsReceipts(workspace).slice(pathsReceiptOffset);
    assert.equal(nativePaths.length, 1, "one shared native Program observes the entire alias population");
    assert.equal(nativePaths[0]!.name, "shared-real-program-probe");
    const slash = (value: string) => value.replace(/\\/g, "/");
    assert.deepEqual(nativePaths[0]!.paths?.["@data"], [slash(path.join(workspace.root, "src/data.json"))]);
    assert.deepEqual(nativePaths[0]!.paths?.["@typed"], [slash(path.join(workspace.root, "src/type-population")), slash(path.resolve("/src/type-population"))]);
    assert.deepEqual(nativePaths[0]!.paths?.["@typed/*"], [slash(path.join(workspace.root, "src/type-population/*")), slash(path.resolve("/src/type-population/*"))]);
    assert.deepEqual(nativePaths[0]!.paths?.["@trail//*"], [slash(path.join(workspace.root, "src/type-population/*"))]);
    for (const unsupportedKey of ["@trail", "@trail/", "@trail/*"])
      assert.equal(Object.prototype.hasOwnProperty.call(nativePaths[0]!.paths ?? {}, unsupportedKey), false, "find-only trailing slash retains its independently specified grammar");
    assert.ok(chunks[0]!.map, "the actual host must return a source map");
  } finally {
    if (previousCache === undefined) delete process.env.TTSC_CACHE_DIR; else process.env.TTSC_CACHE_DIR = previousCache;
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
  }
}
