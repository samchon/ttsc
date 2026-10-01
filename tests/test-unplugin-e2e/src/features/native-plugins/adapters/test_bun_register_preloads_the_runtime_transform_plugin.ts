import assert from "node:assert/strict";

import registerBunRuntime from "../../../../../../packages/unplugin/lib/bun-register.mjs";
import type { BunRegister } from "../../../internal/adapter-bun-register/BunRegister";
import type { CapturedPlugin } from "../../../internal/adapter-bun-register/CapturedPlugin";

/**
 * Verifies the `bun-register` runtime entry registers the adapter with
 * `Bun.plugin` and refuses to run off Bun.
 *
 * Importing the entry off Bun must stay a harmless no-op, but an explicit
 * `register()` off Bun is a configuration mistake and must say so. The built
 * ESM entry is exercised, not its source, with a stubbed `Bun` global.
 *
 * 1. Call `register()` without a `Bun` global and assert it throws a Bun runtime
 *    error.
 * 2. Install a `Bun` stub and call `register()`.
 * 3. Assert exactly one `ttsc-unplugin` plugin with a `setup` function reached
 *    `Bun.plugin`.
 *
 * @evidence contracts/testing.md#behavioral-verification Explicit registration off Bun throws; under a temporary Bun global exactly one named plugin with setup is registered.
 * @evidence contracts/testing.md#independent-expectations Explicit register requires Bun; literal ttsc-unplugin name and setup callable identify the forwarded plugin.
 * @evidence contracts/testing.md#distinguishing-cases Absent global versus present plugin API.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_bun_register_preloads_the_runtime_transform_plugin is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built ESM runtime entry import/registration is exercised; no native compile or actual Bun process runs in this case.
 * @evidence contracts/e2e.md#shared-execution Built ESM/CJS entries reuse captured runtime within each order; separate scopes isolate registration histories.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh module-entry helpers and local captured arrays separate runtime histories; temporary Bun globals are restored in finally. Transform fixtures use private tracked roots. Captured loader sessions have no per-case disposal assertion; process exit bounds their lifetime.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: explicit registration off Bun throws; under a temporary Bun global exactly one named plugin with setup is registered. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
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
