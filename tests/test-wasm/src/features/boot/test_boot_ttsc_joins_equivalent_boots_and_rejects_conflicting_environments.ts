import {
  BootTtscWorkerTerminationError,
  bootTtsc,
  createMemFS,
} from "@ttsc/wasm";
import assert from "node:assert/strict";

import { FAKE_API, withBootStubs } from "../../internal/bootHarness";

/**
 * Verifies bootTtsc joins only boots that are the same binary in the same
 * environment, and fails before starting a runtime when the environment cannot
 * host it.
 *
 * A boot owns three process-wide slots: the cache entry, `globalThis.fs` and
 * the readiness bridge. Joining a caller that names another host or another
 * runtime script would hand back a result that the caller's own options did not
 * produce. A foreign filesystem, a missing Go constructor and a runtime that
 * never publishes its API each need a failure that names the cause, and only
 * the last one has already started a runtime that cannot be stopped.
 *
 * 1. Start a boot whose fetch is held, then join it by absolute and by relative
 *    spelling of one URL and with its own host, and reject a different host and
 *    a different runtime script.
 * 2. Boot while `globalThis.fs` belongs to another object and while the runtime
 *    script installs no Go constructor, and retry each after the cause is
 *    removed.
 * 3. Let a runtime signal readiness without publishing its API and assert the
 *    terminal Worker-replacement error.
 *
 * @evidence contracts/testing.md#behavioral-verification bootTtsc returns one shared promise for equivalent boot options, rejects a conflicting host or runtime-script URL, refuses a foreign globalThis.fs and a missing Go constructor before any runtime starts so a retry succeeds, and reports a ready runtime without its API as a terminal Worker-replacement failure. Promise identity, the one fetch and run counts and the error classes reject a duplicate boot or a retry blocked by a non-terminal failure.
 * @evidence contracts/testing.md#independent-expectations The single-flight contract is that one (apiName, resolved binary URL) pair is one boot, URL spellings resolve against the page location before comparison, and the Go runtime installed by wasm_exec.js defines the Go constructor and the readiness protocol. The expected counts (one fetch, one run) and the error fragments are authored from that contract rather than read from the cache.
 * @evidence contracts/testing.md#distinguishing-cases The absolute and relative spellings of one URL and an omitted or identical host join; a different host and a different runtime script reject. A foreign filesystem and a missing constructor are pre-runtime failures that allow a retry, while the unpublished API is the post-start failure that does not.
 * @evidence contracts/testing.md#execution-ownership test_boot_ttsc_joins_equivalent_boots_and_rejects_conflicting_environments calls the actual bootTtsc through withBootStubs in the Node unit process with doubled fetch, importScripts and Go; no Wasm artifact or Worker runs, and every global the cases touch is restored by the harness.
 */
export const test_boot_ttsc_joins_equivalent_boots_and_rejects_conflicting_environments =
  async (): Promise<void> => {
    const joinApi = "ttscJoinEquivalent";
    let fetches = 0;
    let runs = 0;
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await withBootStubs(
      joinApi,
      {
        onFetch: async () => {
          fetches++;
          await released;
          return { ok: true, status: 200 };
        },
        onRun: async (runtime) => {
          runs++;
          runtime.signalReady(FAKE_API);
          return new Promise<void>(() => undefined);
        },
      },
      async () => {
        const host = createMemFS();
        const first = bootTtsc({
          apiName: joinApi,
          wasmUrl: "http://local/join/a.wasm",
          host,
        });
        assert.equal(
          bootTtsc({ apiName: joinApi, wasmUrl: "/join/a.wasm" }),
          first,
          "a relative spelling joins the absolute one",
        );
        assert.equal(
          bootTtsc({
            apiName: joinApi,
            wasmUrl: "http://local/join/./b/../a.wasm",
            host,
          }),
          first,
          "dot segments resolve before the comparison",
        );
        await assert.rejects(
          bootTtsc({
            apiName: joinApi,
            wasmUrl: "http://local/join/a.wasm",
            host: createMemFS(),
          }),
          /already bound to a different host or wasm_exec\.js URL/,
        );
        await assert.rejects(
          bootTtsc({
            apiName: joinApi,
            wasmUrl: "http://local/join/a.wasm",
            wasmExecUrl: "http://local/other/wasm_exec.js",
          }),
          /already bound to a different host or wasm_exec\.js URL/,
        );
        release();
        const booted = await first;
        assert.equal(booted.api as unknown, FAKE_API);
        assert.equal(booted.host, host);
        assert.equal(fetches, 1, "the joined callers fetched once");
        assert.equal(runs, 1, "the joined callers ran one runtime");
      },
    );

    const foreignApi = "ttscForeignFs";
    await withBootStubs(
      foreignApi,
      {
        onRun: async (runtime) => {
          runtime.signalReady(FAKE_API);
          return new Promise<void>(() => undefined);
        },
      },
      async () => {
        const g = globalThis as Record<string, unknown>;
        const foreign = { owner: "someone else" };
        g.fs = foreign;
        await assert.rejects(
          bootTtsc({
            apiName: foreignApi,
            wasmUrl: "http://local/foreign.wasm",
          }),
          (error: unknown) => {
            assert.ok(!(error instanceof BootTtscWorkerTerminationError));
            assert.match(
              (error as Error).message,
              /globalThis\.fs belongs to a different host/,
            );
            return true;
          },
        );
        assert.equal(g.fs, foreign, "a foreign filesystem is left in place");
        delete g.fs;
        const retried = await bootTtsc({
          apiName: foreignApi,
          wasmUrl: "http://local/foreign.wasm",
        });
        assert.equal(retried.api as unknown, FAKE_API);
      },
    );

    const goApi = "ttscMissingGo";
    await withBootStubs(
      goApi,
      {
        onRun: async (runtime) => {
          runtime.signalReady(FAKE_API);
          return new Promise<void>(() => undefined);
        },
      },
      async () => {
        const g = globalThis as Record<string, unknown>;
        const install = g.importScripts as () => void;
        g.importScripts = (): void => undefined;
        await assert.rejects(
          bootTtsc({ apiName: goApi, wasmUrl: "http://local/no-go.wasm" }),
          (error: unknown) => {
            assert.ok(!(error instanceof BootTtscWorkerTerminationError));
            assert.match(
              (error as Error).message,
              /globalThis\.Go was not installed by http:\/\/local\/wasm_exec\.js/,
            );
            return true;
          },
        );
        assert.equal(
          Object.hasOwn(g, "fs"),
          false,
          "the failed attempt removed the filesystem it installed",
        );
        g.importScripts = install;
        const retried = await bootTtsc({
          apiName: goApi,
          wasmUrl: "http://local/no-go.wasm",
        });
        assert.equal(retried.api as unknown, FAKE_API);
      },
    );

    const missingApi = "ttscMissingApi";
    await withBootStubs(
      missingApi,
      {
        onRun: async (runtime) => {
          runtime.signalReady(null);
          return new Promise<void>(() => undefined);
        },
      },
      async () => {
        await assert.rejects(
          bootTtsc({
            apiName: missingApi,
            wasmUrl: "http://local/no-api.wasm",
          }),
          (error: unknown) => {
            assert.ok(error instanceof BootTtscWorkerTerminationError);
            assert.match(
              (error.cause as Error).message,
              /ttscMissingApi global was not set/,
            );
            return true;
          },
        );
      },
    );
  };
