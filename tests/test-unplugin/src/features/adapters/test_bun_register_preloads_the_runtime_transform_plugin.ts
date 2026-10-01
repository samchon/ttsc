import assert from "node:assert/strict";

import register from "../../../../../packages/unplugin/src/bun-register";
import type { BunLikePlugin } from "../../../../../packages/unplugin/src/core/bun/BunLikePlugin";
import type { BunRuntimeGlobal } from "../../../../../packages/unplugin/src/core/bun/BunRuntimeGlobal";
import { ensureRegistered } from "../../../../../packages/unplugin/src/core/bun/ensureRegistered";
import { registrationState } from "../../../../../packages/unplugin/src/core/bun/registrationState";

/**
 * Verifies Node rejects explicit Bun registration and the registration owner
 * forwards one named loader to its supplied runtime capability.
 *
 * The source entry imports harmlessly off Bun, while an explicit register call
 * reports the unavailable runtime. A private runtime value exercises the
 * supported installation API without replacing globalThis.Bun. Actual preload
 * forwarding and transformed runtime output remain in
 * tests/test-e2e/src/features/unplugin/native-plugins/adapters/
 * test_bun_native_host_owns_build_and_runtime_sessions.ts.
 *
 * @evidence contracts/testing.md#behavioral-verification The source entry exports a function whose explicit Node call throws a Bun-runtime error. ensureRegistered receives a supported private runtime and its actual registrationState, then forwards exactly one ttsc-unplugin descriptor with a callable setup. A repeated installation request leaves that same capture alone.
 * @evidence contracts/testing.md#independent-expectations The literal runtime error, single registration, ttsc-unplugin name and setup capability specify the registration contract independently of provider construction. Descriptor shape does not claim transformed output or actual Bun hook invocation.
 * @evidence contracts/testing.md#distinguishing-cases Absent ambient runtime rejects explicit registration; a supplied supported capability receives the loader and repeated installation is idempotent. Real Bun preload, build disposal and runtime transformation retain their existing E2E owner.
 * @evidence contracts/testing.md#execution-ownership The test-unplugin runner discovers this adapters entry and directly executes authored register, ensureRegistered and registrationState. It imports no built library, patches no foreign global, starts no process and never invokes a transform loader. The five original E2E assertions execute here; actual public-entry-to-Bun forwarding executes in test_bun_native_host_owns_build_and_runtime_sessions.
 */
export function test_bun_register_preloads_the_runtime_transform_plugin(): void {
  assert.equal(typeof register, "function");
  assert.throws(() => register(), /Bun runtime/);

  const captured: BunLikePlugin[] = [];
  const runtime: BunRuntimeGlobal = {
    plugin: (plugin) => { captured.push(plugin); },
  };
  const state = registrationState(runtime);
  ensureRegistered(runtime, state);
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.name, "ttsc-unplugin");
  assert.equal(typeof captured[0]?.setup, "function");
  ensureRegistered(runtime, state);
  assert.equal(captured.length, 1, "an installed runtime loader must not be duplicated");
}
