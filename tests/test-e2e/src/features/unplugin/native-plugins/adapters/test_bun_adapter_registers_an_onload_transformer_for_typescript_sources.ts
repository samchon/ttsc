import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import type { BunLoadOptions } from "../../../../internal/unplugin/internal/adapter-bun/BunLoadOptions";
import type { BunLoader } from "../../../../internal/unplugin/internal/adapter-bun/BunLoader";

/**
 * Verifies the Bun adapter registers an `onLoad` transformer that returns
 * plugin-transformed TypeScript.
 *
 * This is the adapter's basic contract: without a registered loader whose
 * filter matches a `.ts` source, Bun would compile the file untransformed. The
 * Bun `setup` API is stubbed, so no Bun runtime is required.
 *
 * 1. Run the adapter's `setup` against a stub that records `onLoad` registrations.
 * 2. Assert the registered filter matches the project's entry module.
 * 3. Load the entry and assert transformed contents with the `ts` parser.
 *
 * @evidence contracts/testing.md#behavioral-verification Setup registers a filter matching main.ts and loading it returns PLUGIN contents with loader ts.
 * @evidence contracts/testing.md#independent-expectations Fixture goUpper rewrite has literal PLUGIN output; Bun requires ts for emitted TypeScript.
 * @evidence contracts/testing.md#distinguishing-cases Positive TypeScript registration and transformed delivery; excluded and unchanged modules have separate cases.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_bun_adapter_registers_an_onload_transformer_for_typescript_sources is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built adapter registration joins captured Bun setup to real native transform.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: setup registers a filter matching main.ts and loading it returns PLUGIN contents with loader ts. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_bun_adapter_registers_an_onload_transformer_for_typescript_sources(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject();
  const loaders: { loader: BunLoader; options: BunLoadOptions }[] = [];
  unpluginBun().setup({
    onLoad(options: BunLoadOptions, loader: BunLoader) {
      loaders.push({ loader, options });
    },
  });

  const registration = loaders[0];
  assert.ok(registration);
  const { loader, options } = registration;
  if (!options.filter.test(TestUnpluginProject.mainFile(root))) {
    throw new Error("Bun adapter did not register a TypeScript source filter");
  }
  const result = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(result);
  TestUnpluginProject.assertTransformedToPlugin(result.contents);
  // The loader field is what lets the same adapter drive Bun's runtime
  // (`Bun.plugin` / bunfig preload): Bun must be told the emitted contents are
  // still TypeScript so it keeps transpiling them before execution.
  assert.equal(result.loader, "ts");
}
