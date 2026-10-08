import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createEsbuildBuildLifecycle } from "../../../../../packages/unplugin/src/core/esbuild/createEsbuildBuildLifecycle";
import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { beginTtscTransformBuild } from "../../../../../packages/unplugin/src/core/transform/cache/beginTtscTransformBuild";
import { createTransformCacheLease } from "../../../../../packages/unplugin/src/core/transform/cache/createTransformCacheLease";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { sharedBuildTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/sharedBuildTransformCache";
import { unplugin } from "../../../../../packages/unplugin/src/core/unplugin";
import { createViteBuildLifecycle } from "../../../../../packages/unplugin/src/core/vite/createViteBuildLifecycle";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verifies compiler callbacks and the shared session lease preserve ownership.
 *
 * The scripted timer runs the actual idle callback without sleeping or claiming
 * a native scheduling deadline. Lease entries are unresolved consumer promises,
 * not compiler results. The Vite controller also receives an existing supported
 * ready consumer fixture, without proving acquisition or installed Vite hooks.
 * Esbuild ownership uses its own actual controller and joined ready deliveries,
 * whose public observed epoch distinguishes repeated starts from owner counts.
 * Actual webpack/Rspack compilation stays in E2E.
 *
 * 1. Keep one promise through overlapping owners and repeated delivery passes.
 * 2. Release the final owner, cancel that grace through reacquisition, and then
 *    execute the final idle callback to require eviction.
 * 3. Register actual raw webpack/Rspack hooks against captured compiler inputs;
 *    equal options share a pair, closing both watch sessions preserves it, one
 *    compiler shutdown preserves it and the last drops it.
 * 4. Contrast Vite owner overlap, final serve reset, ordinary build grace and
 *    watch retention, including mode values and an end arriving after close.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createEsbuildBuildLifecycle, createViteBuildLifecycle, createTransformCacheLease, beginTtscTransformBuild, sharedBuildTransformCache and actual raw webpack/Rspack registration, watchClose and shutdown callbacks; exact promise and pair identity after both session closures and controlled idle distinguish premature compiler-lease reclamation and stale registry retention.
 * @evidence contracts/testing.md#independent-expectations Active owners and ordinary pass boundaries retain the same promise; final idle removes it. Literal tap names, one restoration rule, 2000ms requested grace and callback cancellation specify independent ownership expectations, not compile counts.
 * @evidence contracts/testing.md#distinguishing-cases Two overlapping owners, duplicate idle release, reacquisition before grace, final idle, equal and distinct option keys, both compiler hook families and a later fresh pair are contrasted. Both compiler sessions close before either compiler shuts down; running idle must preserve their shared promise and pair until actual shutdown releases the final compiler. The actual Vite controller contrasts duplicate/unstarted owners, replacement-before-end, final serve reset, ordinary grace reacquisition, non-nullish watch values, close and late end. Esbuild distinguishes unstarted, duplicate, unknown, overlapping and late disposal identities; two actual coordinator deliveries observe different pass epochs after repeated starts while retaining the exact Promise. Last esbuild disposal resets immediately, distinct from ordinary Vite grace. No compiler output production or installed-host equivalence is inferred.
 * @evidence contracts/testing.md#execution-ownership This exported source unit calls real owners in process. It replaces only controlled testbody global timer descriptors, joins the two ready coordinator deliveries, and restores exact descriptors in finally; no Go peer, host, artifact or wall-clock wait is used.
 */
export async function test_build_cache_leases_follow_compiler_and_session_ownership(): Promise<void> {
  const timerDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "setTimeout",
  )!;
  const clearDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "clearTimeout",
  )!;
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
      const handle = {
        unref: () => {
          unrefs += 1;
        },
      };
      delays.push(delay);
      scheduled.set(handle, callback);
      return handle;
    },
  });
  Object.defineProperty(globalThis, "clearTimeout", {
    ...clearDescriptor,
    value: (handle: object) => {
      scheduled.delete(handle);
    },
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
      unplugin.raw(options, {
        framework,
        [framework]: { compiler: {} },
      } as never),
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
      let watchClose: (() => void) | undefined;
      let shutdown: (() => void) | undefined;
      const compiler = {
        options: { module: { rules } },
        hooks: {
          done: {
            tap: (name: string) => {
              names.push(name);
            },
          },
          watchClose: {
            tap: (name: string, callback: () => void) => {
              names.push(name);
              watchClose = callback;
            },
          },
          shutdown: {
            tap: (name: string, callback: () => void) => {
              names.push(name);
              shutdown = callback;
            },
          },
        },
      };
      const register = plugin.webpack ?? plugin.rspack;
      assert.equal(typeof register, "function");
      (register as (compiler: unknown) => void)(compiler);
      assert.deepEqual(names, [
        "ttsc-unplugin",
        "ttsc-unplugin",
        "ttsc-unplugin",
      ]);
      assert.equal(rules.length, 1);
      assert.equal(typeof watchClose, "function");
      assert.equal(typeof shutdown, "function");
      shutdowns.push(shutdown!);
      watchClose!();
      runIdle();
      assert.equal(
        shared.cache.get("consumer"),
        pending,
        "closing a watch session must retain its compiler's lease",
      );
      assert.equal(sharedBuildTransformCache(key), shared);
    }
    shutdowns[0]!();
    runIdle();
    assert.equal(shared.cache.get("consumer"), pending);
    assert.equal(sharedBuildTransformCache(key), shared);
    shutdowns[1]!();
    assert.equal(
      shared.cache.get("consumer"),
      pending,
      "last shutdown starts grace",
    );
    runIdle();
    assert.equal(shared.cache.size, 0);
    const fresh = sharedBuildTransformCache(key);
    assert.notEqual(fresh, shared);
    runIdle();

    const fixture = createCachedDeliveryUnitFixture();
    const ready = Promise.resolve(fixture.good);
    const lifecycle = createViteBuildLifecycle(fixture.cache);
    const first = {};
    const replacement = {};
    const seed = (): void => {
      fixture.cache.set(fixture.key, ready);
    };
    try {
      assert.equal(lifecycle.command, undefined);
      assert.equal(lifecycle.watching, true);
      assert.equal(lifecycle.buildWatching, false);
      lifecycle.start(first);
      lifecycle.configure({
        command: "serve",
        server: { watch: null },
        build: { watch: undefined },
      });
      assert.equal(lifecycle.watching, false);
      assert.equal(lifecycle.buildWatching, false);
      seed();
      assert.equal(
        lifecycle.end(first),
        true,
        "an unconfigured start did not register an owner",
      );
      assert.equal(fixture.cache.size, 0);
      lifecycle.configure({
        command: "serve",
        server: { watch: undefined },
        build: { watch: null },
      });
      assert.equal(lifecycle.watching, true);
      assert.equal(lifecycle.buildWatching, false);
      seed();
      lifecycle.start(first);
      lifecycle.start(first);
      lifecycle.start(replacement);
      assert.equal(
        lifecycle.end({}),
        false,
        "an unstarted identity cannot decrement active owners",
      );
      assert.equal(
        lifecycle.end(first),
        false,
        "replacement starts before its predecessor ends",
      );
      assert.equal(fixture.cache.get(fixture.key), ready);
      assert.equal(
        lifecycle.end(replacement),
        true,
        "duplicate start did not add ownership",
      );
      assert.equal(
        fixture.cache.size,
        0,
        "last serve end resets the ready consumer owner",
      );

      const settled = {
        command: "serve",
        server: { watch: undefined as unknown },
        build: { watch: undefined as unknown },
      };
      lifecycle.configure(settled);
      settled.server.watch = null;
      lifecycle.start(first);
      assert.equal(
        lifecycle.watching,
        false,
        "later config hooks disable serve watching",
      );
      assert.equal(lifecycle.usePolling, false);
      lifecycle.end(first);
      settled.server.watch = { usePolling: true };
      lifecycle.start(first);
      assert.equal(
        lifecycle.watching,
        true,
        "the next container reads its current watch options",
      );
      assert.equal(lifecycle.usePolling, true);
      lifecycle.end(first);
      settled.server.watch = {};
      lifecycle.start(first);
      assert.equal(
        lifecycle.usePolling,
        false,
        "native watching withdraws the previous polling declaration",
      );
      lifecycle.end(first);
      settled.command = "build";
      lifecycle.configure(settled);
      settled.build.watch = {};
      seed();
      lifecycle.start(first);
      assert.equal(lifecycle.buildWatching, true);
      lifecycle.end(first);
      assert.equal(scheduled.size, 0, "late build watch retains the session");
      assert.equal(fixture.cache.get(fixture.key), ready);
      settled.build.watch = null;
      lifecycle.start(first);
      assert.equal(lifecycle.buildWatching, false);
      lifecycle.end(first);
      assert.equal(
        scheduled.size,
        1,
        "late watch removal releases ordinary build grace",
      );
      runIdle();
      assert.equal(fixture.cache.size, 0);

      lifecycle.configure({ command: "build" });
      seed();
      lifecycle.start(first);
      lifecycle.start(replacement);
      assert.equal(lifecycle.end(first), false);
      assert.equal(scheduled.size, 0);
      assert.equal(lifecycle.end(replacement), true);
      assert.equal(scheduled.size, 1);
      assert.equal(
        fixture.cache.get(fixture.key),
        ready,
        "ordinary build releases through grace",
      );
      lifecycle.start(first);
      assert.equal(
        scheduled.size,
        0,
        "a new ordinary build cancels the idle release",
      );
      runIdle();
      assert.equal(fixture.cache.get(fixture.key), ready);
      assert.equal(lifecycle.end(first), true);
      runIdle();
      assert.equal(fixture.cache.size, 0);

      lifecycle.configure({ command: "build", build: { watch: false } });
      assert.equal(
        lifecycle.buildWatching,
        true,
        "any non-nullish build watch value enables watch mode",
      );
      seed();
      lifecycle.start(first);
      assert.equal(lifecycle.end(first), true);
      assert.equal(scheduled.size, 0);
      assert.equal(fixture.cache.get(fixture.key), ready);
      lifecycle.start(replacement);
      lifecycle.close();
      assert.equal(fixture.cache.size, 0);
      assert.equal(
        lifecycle.end(replacement),
        true,
        "late end after close cannot decrement below zero",
      );
      seed();
      lifecycle.start(first);
      assert.equal(lifecycle.end(first), true);
      assert.equal(
        fixture.cache.get(fixture.key),
        ready,
        "a fresh watch owner still uses the reset identity set",
      );
      lifecycle.close();

      const projectRoot = path.dirname(path.dirname(fixture.file));
      const tsconfig = path.join(projectRoot, "tsconfig.json");
      const observed = observeValidationUnitGeneration(projectRoot, {
        ...fixture.good.result,
        hostInputs: [tsconfig],
        hostInputHashes: {
          [tsconfig]: createHash("sha256")
            .update(fs.readFileSync(tsconfig))
            .digest("hex"),
        },
        hostInputRealpaths: { [tsconfig]: fs.realpathSync.native(tsconfig) },
      });
      const esbuildOwner = Promise.resolve(observed);
      const esbuildLifecycle = createEsbuildBuildLifecycle(fixture.cache);
      fixture.cache.set(fixture.key, esbuildOwner);
      assert.equal(
        esbuildLifecycle.dispose(first),
        false,
        "setup without start cannot release another owner",
      );
      assert.equal(fixture.cache.get(fixture.key), esbuildOwner);
      esbuildLifecycle.start(first);
      assert.equal(
        (
          await fixture.api.transformTtsc(
            fixture.file,
            fixture.source,
            fixture.options,
            undefined,
            fixture.cache,
          )
        )?.code,
        fixture.code,
      );
      const firstEpoch = observed.deliveryEpoch;
      assert.equal(typeof firstEpoch, "number");
      esbuildLifecycle.start(first);
      assert.equal(
        (
          await fixture.api.transformTtsc(
            fixture.file,
            fixture.source,
            fixture.options,
            undefined,
            fixture.cache,
          )
        )?.code,
        fixture.code,
      );
      assert.notEqual(
        observed.deliveryEpoch,
        firstEpoch,
        "even a duplicate owner's start opens another actual delivery pass",
      );
      assert.equal(fixture.cache.get(fixture.key), esbuildOwner);
      esbuildLifecycle.start(replacement);
      assert.equal(esbuildLifecycle.dispose({}), false);
      assert.equal(
        esbuildLifecycle.dispose(first),
        false,
        "replacement is active before the old owner disposes",
      );
      assert.equal(
        esbuildLifecycle.dispose(first),
        false,
        "duplicate start did not add ownership",
      );
      assert.equal(fixture.cache.get(fixture.key), esbuildOwner);
      assert.equal(esbuildLifecycle.dispose(replacement), true);
      assert.equal(
        fixture.cache.size,
        0,
        "last started owner resets the cache immediately",
      );
      fixture.cache.set(fixture.key, esbuildOwner);
      esbuildLifecycle.start(replacement);
      assert.equal(
        esbuildLifecycle.dispose(first),
        false,
        "late disposal cannot release a newly started owner",
      );
      assert.equal(fixture.cache.get(fixture.key), esbuildOwner);
      assert.equal(esbuildLifecycle.dispose(replacement), true);
      assert.equal(fixture.cache.size, 0);
    } finally {
      lifecycle.close();
      fixture.dispose();
    }
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
