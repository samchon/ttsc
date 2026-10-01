import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { captureBunLoader } from "../../../../internal/unplugin/internal/adapter-bun/captureBunLoader";

/**
 * Verifies Bun runtime pass-through satisfies its stricter loader contract.
 *
 * Unlike `Bun.build`, `Bun.plugin()` rejects an `onLoad` result of `undefined`.
 * Excluded or unchanged TypeScript must therefore be returned explicitly with
 * its loader instead of using the bundler's next-loader signal.
 *
 * 1. Capture the runtime-mode loader of an adapter with no plugins.
 * 2. Load the project's entry module.
 * 3. Assert the result is the unchanged source with the `ts` loader.
 *
 * @evidence contracts/testing.md#behavioral-verification Runtime onLoad returns exactly source bytes and ts for a plugin-free entry.
 * @evidence contracts/testing.md#independent-expectations Source read before delivery is independent unchanged-byte oracle; Bun runtime requires an explicit result.
 * @evidence contracts/testing.md#distinguishing-cases Runtime unchanged module versus bundler undefined in its companion case.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_bun_runtime_passes_through_unchanged_source is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built runtime adapter delivers native no-change result through captured Bun onLoad.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: runtime onLoad returns exactly source bytes and ts for a plugin-free entry. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_bun_runtime_passes_through_unchanged_source(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const file = TestUnpluginProject.mainFile(root);
  const source = fs.readFileSync(file, "utf8");
  const { loader } = await captureBunLoader(
    unpluginBun({ plugins: [] }),
    "runtime",
  );

  assert.deepEqual(await loader({ path: file }), {
    contents: source,
    loader: "ts",
  });
}
