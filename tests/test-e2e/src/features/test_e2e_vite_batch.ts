import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";
import { build } from "vite";

import { BatchWorkspace } from "../batch/BatchWorkspace";

/**
 * Verifies Vite's actual Rollup build consumes one complete transformed graph.
 *
 * One source producer supplies the JSON alias, strip control and complete native
 * JSX matrix. Every output assertion reads this build; no scenario restarts it.
 *
 * 1. Start one real Vite build with the emitted adapter.
 * 2. Interpret its one IIFE graph and compare all literal values.
 * 3. Require configured debug removal and one JavaScript output graph.
 *
 * @evidence contracts/testing.md#behavioral-verification One real Vite/Rollup output runs the complete source graph with contract42, JSON42/retained and661 exact UTF-16 values; configured throwing calls must not execute and debug labels must be absent.
 * @evidence contracts/testing.md#independent-expectations Original pre-print string inputs and authored JSON/contract literals determine expected runtime values independently of bundler output.
 * @evidence contracts/testing.md#distinguishing-cases Quoted JSX entities, expression strings, raw strings and retained versus stripped effects are simultaneous members of one bundle.
 * @evidence contracts/testing.md#execution-ownership The selected batch calls build once and only interprets returned output afterward; no legacy Vite, Rollup or profile function is invoked.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite and Rollup must load the emitted adapter, native transforms and output graph. Direct cache or hook policy units cannot prove this assembly.
 * @evidence contracts/e2e.md#shared-execution One immutable consumer, producer cache and one Vite/Rollup host serve all661 value assertions and utility observations; no per-row preparation or build remains.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity write:false prevents fixture publication. The awaited one-shot build owns its supported teardown; ambient NODE_ENV and native-cache selection restore in finally before another consumer.
 * @evidence contracts/e2e.md#preserved-coverage Combines real Vite transform delivery, underlying Rollup assembly and actual utility/value meanings. It does not certify every original independent adapter lifecycle or mapped unit's execution.
 */
export async function test_e2e_vite_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const previousCache = process.env.TTSC_CACHE_DIR;
  const previousMode = process.env.NODE_ENV;
  process.env.TTSC_CACHE_DIR = workspace.cache;
  try {
    const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
    const result = await build({
      root: workspace.root, configFile: false, logLevel: "silent",
      plugins: [adapter()],
      build: { minify: false, write: false, sourcemap: true,
        rollupOptions: { input: path.join(workspace.root, "src/bundle.ts"), output: { format: "iife", name: "SharedBoundary" } } },
    });
    const outputs = Array.isArray(result) ? result.flatMap((entry) => entry.output) : "output" in result ? result.output : [];
    const chunks = outputs.filter((output) => output.type === "chunk");
    assert.equal(chunks.length, 1);
    const code = chunks[0]!.code;
    assert.doesNotMatch(code, /STRIPPED_DEBUG_RAN/);
    BatchWorkspace.assertResult(BatchWorkspace.readBundle(code), workspace.expected);
    assert.ok(chunks[0]!.map, "the actual host must return a source map");
  } finally {
    if (previousCache === undefined) delete process.env.TTSC_CACHE_DIR; else process.env.TTSC_CACHE_DIR = previousCache;
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
  }
}
