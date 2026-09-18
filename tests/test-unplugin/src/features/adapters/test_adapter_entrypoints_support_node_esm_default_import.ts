import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies every ESM entrypoint exposes a callable default export through
 * `import()`.
 *
 * The `.mjs` files are emitted separately from the CommonJS ones, so the
 * default export has to survive in that format as well. The root index must
 * expose the unified instance, and each adapter entry its own factory.
 *
 * 1. Import the root index and assert its default carries the `vite` factory.
 * 2. Import every adapter entry.
 * 3. Assert each default export is a function.
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
