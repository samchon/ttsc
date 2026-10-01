import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { captureBunLoader } from "../../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies the Bun adapter keeps producing correct output when a transform
 * plugin reports dependencies.
 *
 * The shared transform calls `addWatchFile` once per plugin-reported
 * dependency. The Bun adapter used to invoke the raw transform with an empty
 * receiver, so any reported dependency threw `TypeError: this.addWatchFile is
 * not a function`. Bun exposes no per-module dependency channel, so the adapter
 * must supply an explicit no-op watch context. The list mixes a
 * project-relative entry, an absolute entry, a duplicate, and the module
 * itself, every shape that reaches the watch hook.
 *
 * 1. Configure a plugin that reports those four dependency shapes.
 * 2. Load the entry module twice, a fresh transform and a cache hit.
 * 3. Assert both return transformed contents with the `ts` parser.
 *
 * @evidence contracts/testing.md#behavioral-verification First and repeated loads both return transformed contents and ts despite relative, absolute, duplicate and self dependencies.
 * @evidence contracts/testing.md#independent-expectations Fixture rewrite fixes PLUGIN; Bun has no per-module dependency channel, so notifications must not throw.
 * @evidence contracts/testing.md#distinguishing-cases Cold delivery and replay with all four reported path shapes.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_bun_adapter_survives_plugin_reported_dependencies is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Captured Bun receiver reaches native plugin dependency reporting; no live Bun watch behavior is claimed.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: first and repeated loads both return transformed contents and ts despite relative, absolute, duplicate and self dependencies. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_bun_adapter_survives_plugin_reported_dependencies(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const absolute = path.join("/abs", "types", "model.d.ts");
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "emit-dependencies",
        dependencies: [
          "src/types.d.ts",
          absolute,
          "src/types.d.ts",
          "src/main.ts",
        ],
      },
    ],
  });
  const { loader } = await captureBunLoader(unpluginBun());

  // Fresh transform: the reported dependencies reach the watch hook. The old
  // empty-receiver context threw here instead of returning source.
  const first = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(first);
  TestUnpluginProject.assertTransformedToPlugin(first.contents);
  assert.equal(first.loader, "ts");

  // Cache hit: the shared transform replays the dependency notification, so the
  // no-op context must stay valid on the second load too.
  const second = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(second);
  TestUnpluginProject.assertTransformedToPlugin(second.contents);
  assert.equal(second.loader, "ts");
}
