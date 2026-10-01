import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { captureBunLoader } from "../../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies excluded files and no-op transforms fall through to Bun's next
 * loader.
 *
 * Bun stops at the first `onLoad` callback that returns a value. The adapter's
 * broad TypeScript filter therefore must consult the shared `transformInclude`
 * predicate before reading and return `undefined` when the path is excluded or
 * the transform produced no code.
 *
 * 1. Capture the bundler-mode loader of the Bun adapter.
 * 2. Load a `node_modules` source that does not exist, and assert `undefined`
 *    without a read.
 * 3. Load the entry of a project with no plugins, and assert `undefined` so Bun's
 *    built-in TypeScript loader takes it.
 *
 * @evidence contracts/testing.md#behavioral-verification Captured bundler onLoad returns undefined for a nonexistent node_modules path and a plugin-free entry, detecting loader-chain capture or an unwanted disk read.
 * @evidence contracts/testing.md#independent-expectations Bun bundler fall-through is undefined; the absent excluded file would fail any read.
 * @evidence contracts/testing.md#distinguishing-cases Excluded nonexistent source versus included source with no rewrite.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_bun_adapter_falls_through_for_excluded_and_unchanged_modules is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built Bun entry registration and native transform are real; Bun setup is captured rather than a live Bun host.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: captured bundler onLoad returns undefined for a nonexistent node_modules path and a plugin-free entry, detecting loader-chain capture or an unwanted disk read. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_bun_adapter_falls_through_for_excluded_and_unchanged_modules(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const { loader } = await captureBunLoader(
    unpluginBun({
      plugins: [],
    }),
    "bundler",
  );

  assert.equal(
    await loader({
      path: path.join(
        TestUnpluginProject.createProject(),
        "node_modules",
        "missing",
        "index.ts",
      ),
    }),
    undefined,
    "an excluded path must not be read or claim the loader chain",
  );

  const root = TestUnpluginProject.createProject({ plugins: [] });
  assert.equal(
    await loader({ path: TestUnpluginProject.mainFile(root) }),
    undefined,
    "a no-op transform must fall through to Bun's built-in TypeScript loader",
  );
}
