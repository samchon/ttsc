import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import type { BunLoadOptions } from "../../internal/adapter-bun/BunLoadOptions";
import type { BunLoader } from "../../internal/adapter-bun/BunLoader";

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
