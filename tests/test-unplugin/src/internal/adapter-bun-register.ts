import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/** Shape the runtime preload forwards to `Bun.plugin`. */
interface CapturedPlugin {
  name: string;
  setup: (build: unknown) => unknown;
}

/**
 * Asserts the `bun-register` runtime entry: importing it off Bun is a harmless
 * no-op, an explicit `register()` off Bun throws a clear error, and under a
 * Bun-like global it forwards the `ttsc-unplugin` adapter to `Bun.plugin`.
 *
 * Stubs `globalThis.Bun` so no real Bun runtime is required; loads the built
 * entrypoint via `TestUnpluginRuntime.libUrl("bun-register")`.
 */
async function assertBunRegisterRegistersRuntimePlugin() {
  const mod = await import(TestUnpluginRuntime.libUrl("bun-register"));
  const register = mod.default as (options?: unknown) => void;
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

export { assertBunRegisterRegistersRuntimePlugin };
