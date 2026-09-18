import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies that all ESM entrypoints expose a callable `default` export via
 * dynamic `import()`, covering the root index and every bundler-specific
 * adapter.
 */
export async function test_adapter_entrypoints_support_node_esm_default_import(): Promise<void> {
  const root = await import(TestUnpluginRuntime.libUrl("index"));
  assert.equal(typeof root.default.vite, "function", "index");

  for (const entrypoint of [
    "bun",
    "esbuild",
    "farm",
    "next",
    "rolldown",
    "rollup",
    "rspack",
    "turbopack",
    "vite",
    "webpack",
  ]) {
    const mod = await import(TestUnpluginRuntime.libUrl(entrypoint));
    assert.equal(typeof mod.default, "function", entrypoint);
  }
}
