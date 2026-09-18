import assert from "node:assert/strict";

import registerBunRuntime from "../../../../../packages/unplugin/lib/bun-register.mjs";
import type { BunRegister } from "../../internal/adapter-bun-register/BunRegister";
import type { CapturedPlugin } from "../../internal/adapter-bun-register/CapturedPlugin";

/**
 * Verifies the `bun-register` runtime entry: importing it off Bun is a harmless
 * no-op, an explicit `register()` off Bun throws a clear error, and under a
 * Bun-like global it forwards the `ttsc-unplugin` adapter to `Bun.plugin`.
 *
 * Stubs `globalThis.Bun` so no real Bun runtime is required, and imports the
 * built ESM entrypoint so the published module, not its source, is exercised.
 */
export async function test_bun_register_preloads_the_runtime_transform_plugin(): Promise<void> {
  const register = registerBunRuntime as unknown as BunRegister;
  assert.equal(typeof register, "function");

  // Off Bun, an explicit register() must fail loud rather than silently no-op.
  assert.throws(() => register(), /Bun runtime/);

  // Under a Bun-like global, register() forwards the adapter to Bun.plugin.
  const captured: CapturedPlugin[] = [];
  const holder = globalThis as { Bun?: unknown };
  const priorBun = holder.Bun;
  holder.Bun = {
    plugin: (plugin: CapturedPlugin) => captured.push(plugin),
  };
  try {
    register();
  } finally {
    if (priorBun === undefined) delete holder.Bun;
    else holder.Bun = priorBun;
  }
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.name, "ttsc-unplugin");
  assert.equal(typeof captured[0]?.setup, "function");
}
