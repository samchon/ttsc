import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { build } from "esbuild";

import { BatchWorkspace } from "../batch/BatchWorkspace";

/**
 * Verifies one real esbuild graph and its actual disposal carry all source rows.
 *
 * The built adapter is a public esbuild plugin. A public onDispose observer
 * awaits this same build's teardown without intercepting internal methods.
 *
 * 1. Build the shared multi-module graph once through the real adapter.
 * 2. Await the build's public disposal and interpret its actual IIFE.
 * 3. Compare the full independent matrix and retained utility controls.
 *
 * @evidence contracts/testing.md#behavioral-verification One real esbuild output must yield all661 exact native string values and authored contract/JSON neighbors with parsed-source controls retained; its public disposal must occur exactly once.
 * @evidence contracts/testing.md#independent-expectations Pre-print UTF-16 literals and authored42/retained values fix expected meaning. onDispose is the public host event rather than a predicted native process count.
 * @evidence contracts/testing.md#distinguishing-cases All quote/context/control string contrasts and parsed-source controls coexist in the same graph. Disposal is distinguished from a build that leaves its registered owner alive.
 * @evidence contracts/testing.md#execution-ownership This selected batch invokes esbuild.build exactly once. The rows are assertions on returned bytes, never separate context/rebuild calls.
 * @evidence contracts/e2e.md#necessary-boundary Public esbuild plugin setup, native output delivery and onDispose must agree under the real host; captured hooks alone cannot establish that connection.
 * @evidence contracts/e2e.md#shared-execution One existing input graph, plugin artifact and one build serve every value. Compatible inputs share preparation; this test starts no per-row compiler or project.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity write:false preserves inputs and public onDispose is awaited after the actual build. Cache environment restores in finally; a failed build remains an error and does not certify successful teardown.
 * @evidence contracts/e2e.md#preserved-coverage Keeps actual esbuild adapter delivery and teardown with the common value/utility matrix. Original overlapping-context and replacement-generation counts remain separate coverage obligations, not presumed from this one build.
 */
export async function test_e2e_esbuild_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const previous = process.env.TTSC_CACHE_DIR;
  process.env.TTSC_CACHE_DIR = workspace.cache;
  let disposals = 0;
  let resolveDisposed!: () => void;
  const disposed = new Promise<void>((resolve) => { resolveDisposed = resolve; });
  try {
    const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("esbuild");
    const result = await build({
      absWorkingDir: workspace.root, entryPoints: ["src/bundle.ts"],
      bundle: true, minify: false, format: "iife", write: false, sourcemap: "inline", logLevel: "silent",
      plugins: [adapter(), { name: "observe-shared-build-disposal", setup(host) {
        host.onDispose(() => { disposals++; resolveDisposed(); });
      } }],
    });
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([disposed, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("esbuild disposal did not complete")), 30_000);
      })]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
    assert.equal(disposals, 1);
    assert.equal(result.outputFiles.length, 1);
    const code = result.outputFiles[0]!.text;
    BatchWorkspace.assertResult(BatchWorkspace.readBundle(code), workspace.expected);
  } finally {
    if (previous === undefined) delete process.env.TTSC_CACHE_DIR; else process.env.TTSC_CACHE_DIR = previous;
  }
}

