import assert from "node:assert/strict";

import { unplugin } from "../../../../../packages/unplugin/src/core/unplugin";
import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import { beginTtscTransformBuild } from "../../../../../packages/unplugin/src/core/transform/cache/beginTtscTransformBuild";
import { createTransformCacheLease } from "../../../../../packages/unplugin/src/core/transform/cache/createTransformCacheLease";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { sharedBuildTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/sharedBuildTransformCache";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";

/**
 * Verifies compiler callbacks and the shared session lease preserve ownership.
 *
 * The scripted timer runs the actual idle callback without sleeping or claiming
 * a native scheduling deadline. Cache entries are unresolved consumer promises,
 * not compiler results. Actual webpack/Rspack compilation stays in E2E.
 *
 * 1. Keep one promise through overlapping owners and repeated delivery passes.
 * 2. Release the final owner, cancel that grace through reacquisition, and then
 *    execute the final idle callback to require eviction.
 * 3. Register actual raw webpack/Rspack hooks against captured compiler inputs;
 *    equal options share a pair, one shutdown preserves it and the last drops it.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createTransformCacheLease, beginTtscTransformBuild, sharedBuildTransformCache and actual raw webpack/Rspack registration/shutdown callbacks; exact promise and pair identity distinguish premature reclamation and stale registry retention.
 * @evidence contracts/testing.md#independent-expectations Active owners and ordinary pass boundaries retain the same promise; final idle removes it. Literal tap names, one restoration rule, 2000ms requested grace and callback cancellation specify independent ownership expectations, not compile counts.
 * @evidence contracts/testing.md#distinguishing-cases Two overlapping owners, duplicate idle release, reacquisition before grace, final idle, equal and distinct option keys, both compiler hook families and a later fresh pair are contrasted. No output or installed-host equivalence is inferred.
 * @evidence contracts/testing.md#execution-ownership This exported source unit calls real owners in process. It replaces only testbody global timer descriptors synchronously and restores exact descriptors in finally; no Go peer, host, artifact or wall-clock wait is used.
 */
export function test_build_cache_leases_follow_compiler_and_session_ownership(): void {
  const timerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "setTimeout")!;
  const clearDescriptor = Object.getOwnPropertyDescriptor(globalThis, "clearTimeout")!;
  const scheduled = new Map<object, () => void>();
  const delays: number[] = [];
  let unrefs = 0;
  const runIdle = (): void => {
    for (const [handle, callback] of [...scheduled]) {
      scheduled.delete(handle);
      callback();
    }
  };
  Object.defineProperty(globalThis, "setTimeout", {
    ...timerDescriptor,
    value: (callback: () => void, delay: number) => {
      const handle = { unref: () => { unrefs += 1; } };
      delays.push(delay);
      scheduled.set(handle, callback);
      return handle;
    },
  });
  Object.defineProperty(globalThis, "clearTimeout", {
    ...clearDescriptor,
    value: (handle: object) => { scheduled.delete(handle); },
  });
  const shutdowns: (() => void)[] = [];
  try {
    const cache = createTtscTransformCache();
    const pending = new Promise<TtscCachedProjectTransform>(() => {});
    cache.set("consumer", pending);
    const lease = createTransformCacheLease(cache);
    lease.acquire();
    lease.acquire();
    for (let pass = 0; pass < 3; pass += 1) {
      beginTtscTransformBuild(cache);
      assert.equal(cache.get("consumer"), pending);
    }
    lease.release();
    assert.equal(scheduled.size, 0);
    lease.release();
    lease.release();
    assert.equal(scheduled.size, 1, "duplicate release does not add a timer");
    assert.equal(cache.get("consumer"), pending);
    lease.acquire();
    assert.equal(scheduled.size, 0, "reacquisition cancels pending idle");
    runIdle();
    assert.equal(cache.get("consumer"), pending);
    lease.release();
    runIdle();
    assert.equal(cache.size, 0);

    const options = { project: "ownership-only-never-compiled.tsconfig.json" };
    const plugins = (["webpack", "rspack"] as const).map((framework) =>
      unplugin.raw(options, { framework, [framework]: { compiler: {} } } as never),
    );
    const key = JSON.stringify(resolveOptions(options));
    const shared = sharedBuildTransformCache(key);
    assert.equal(sharedBuildTransformCache(key), shared);
    const distinct = sharedBuildTransformCache(key + "distinct");
    assert.notEqual(distinct, shared);
    runIdle();
    shared.cache.set("consumer", pending);
    for (const plugin of plugins) {
      const rules: unknown[] = [];
      const names: string[] = [];
      let shutdown: (() => void) | undefined;
      const compiler = {
        options: { module: { rules } },
        hooks: {
          done: { tap: (name: string) => { names.push(name); } },
          shutdown: { tap: (name: string, callback: () => void) => {
            names.push(name);
            shutdown = callback;
          } },
        },
      };
      const register = plugin.webpack ?? plugin.rspack;
      assert.equal(typeof register, "function");
      (register as (compiler: unknown) => void)(compiler);
      assert.deepEqual(names, ["ttsc-unplugin", "ttsc-unplugin"]);
      assert.equal(rules.length, 1);
      assert.equal(typeof shutdown, "function");
      shutdowns.push(shutdown!);
    }
    shutdowns[0]!();
    runIdle();
    assert.equal(shared.cache.get("consumer"), pending);
    assert.equal(sharedBuildTransformCache(key), shared);
    shutdowns[1]!();
    assert.equal(shared.cache.get("consumer"), pending, "last shutdown starts grace");
    runIdle();
    assert.equal(shared.cache.size, 0);
    const fresh = sharedBuildTransformCache(key);
    assert.notEqual(fresh, shared);
    runIdle();
    assert.ok(delays.length > 0);
    assert.ok(delays.every((delay) => delay === 2000));
    assert.equal(unrefs, delays.length);
  } finally {
    for (const shutdown of shutdowns) shutdown();
    runIdle();
    Object.defineProperty(globalThis, "setTimeout", timerDescriptor);
    Object.defineProperty(globalThis, "clearTimeout", clearDescriptor);
  }
}
