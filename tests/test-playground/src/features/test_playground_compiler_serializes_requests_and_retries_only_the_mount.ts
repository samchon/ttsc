import type { IBootResult, ITtscResult } from "@ttsc/wasm";
import assert from "node:assert/strict";

import {
  BASE_OPTIONS,
  compilePayload,
  envelope,
  makeFakeWorker,
} from "../internal/fakeWorker";
import { createWorkerCompilerService } from "../../../../packages/playground/src/compiler/internal/createWorkerCompilerService";

/**
 * Verifies the worker compiler runs requests one at a time over its shared
 * virtual project, and that a failed source-pack mount retries without booting
 * a second runtime.
 *
 * The wasm-side host runs concurrent calls concurrently, so a keystroke could
 * interleave a lint pass with a bundle that has rewritten the tsconfig. The
 * service therefore chains every request, and a failure must not stall the
 * chain. Booting and mounting have separate caches because the Go runtime of a
 * Worker cannot be replaced, while the mount can simply be tried again.
 *
 * 1. Start a compile whose build is held, queue a lint and a second compile, and
 *    record the order in which the doubles are entered once the first build is
 *    released.
 * 2. Mount a source pack that fails once: the first request reports it, the next
 *    request mounts again and succeeds, and the runtime booted exactly once.
 * 3. Reject one chained request and assert the next one still runs.
 *
 * @evidence contracts/testing.md#behavioral-verification createWorkerCompilerService starts a queued lint and compile only after the running build finishes, reports a failed mount without booting a second runtime, mounts again on the next request, and keeps serving after a rejected request. The recorded entry order, the boot count and the mount count reject concurrent execution, a cached failed mount and a stalled chain.
 * @evidence contracts/testing.md#independent-expectations The serialization contract is that one request's mutations of the virtual project finish before the next begins, and that a started Go runtime is never booted again in a Worker. The authored gates, call log and the literal counts one boot and two mounts are the oracle, not a copy of the chaining code.
 * @evidence contracts/testing.md#distinguishing-cases A held build against queued lint and compile contrasts waiting with overlapping; a mount that fails once contrasts with one that succeeds on retry; a rejected request contrasts with the request queued behind it. A failing runtime boot (not the mount) is owned by test_worker_compiler_caches_terminal_boot_failures.
 * @evidence contracts/testing.md#execution-ownership This entry calls the real createWorkerCompilerService with injected boot, API and host doubles in the unit process and owns the gate promises and counters; no WASM runtime, Worker or compiler process runs.
 */
export const test_playground_compiler_serializes_requests_and_retries_only_the_mount =
  async (): Promise<void> => {
    // 1. Serialization.
    {
      const log: string[] = [];
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { service } = makeFakeWorker(
        { ...BASE_OPTIONS, typiaPlugin: false, lintPlugin: {} },
        {
          build: async () => {
            log.push("build:start");
            await gate;
            log.push("build:end");
            return envelope({
              result: compilePayload({ "src/playground.js": "x = 1;" }),
            });
          },
          plugin: (opts) => {
            log.push(`plugin:${opts.command}`);
            return envelope({});
          },
        },
      );
      const first = service.compile({ source: "export const a = 1;" });
      const lint = service.lint({ source: "export const a = 1;" });
      const second = service.compile({ source: "export const b = 2;" });
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      assert.deepEqual(
        log,
        ["build:start"],
        "queued requests wait for the running build",
      );
      release();
      const results = await Promise.all([first, lint, second]);
      assert.deepEqual(log, [
        "build:start",
        "build:end",
        "plugin:check",
        "build:start",
        "build:end",
      ]);
      assert.equal(results[0].type, "success");
      assert.deepEqual(results[1], { diagnostics: [] });
      assert.equal(results[2].type, "success");
    }

    // 2. Mount retry reuses the booted runtime.
    {
      let boots = 0;
      let mounts = 0;
      const mounted: unknown[][] = [];
      const host = {
        mkdirp(): void {},
        writeFile(): void {},
      } as unknown as IBootResult["host"];
      const api = {
        async build(): Promise<ITtscResult> {
          return envelope({
            result: compilePayload({ "src/playground.js": "x = 1;" }),
          });
        },
        async plugin(): Promise<ITtscResult> {
          return envelope({});
        },
      } as unknown as IBootResult["api"];
      const service = createWorkerCompilerService(
        {
          bootTtsc: async () => {
            boots++;
            return { api, host };
          },
          parseResult: <T>(result: ITtscResult): T | null =>
            JSON.parse(result.result) as T,
        },
        {
          ...BASE_OPTIONS,
          workDir: "/proj",
          lintPlugin: false,
          typiaPlugin: {
            mount: async (mountHost, workDir) => {
              mounts++;
              mounted.push([mountHost, workDir]);
              if (mounts === 1) throw new Error("source pack download failed");
            },
          },
        },
      );
      const first = await service.compile({ source: "export const a = 1;" });
      assert.equal(first.type, "error");
      assert.match(
        (first.value as { message: string }).message,
        /source pack download failed/,
      );
      const second = await service.compile({ source: "export const a = 1;" });
      assert.equal(second.type, "success");
      const third = await service.compile({ source: "export const a = 1;" });
      assert.equal(third.type, "success");
      assert.equal(boots, 1, "the runtime booted once across the mount retry");
      assert.equal(mounts, 2, "the mount ran again after its failure only");
      assert.deepEqual(mounted, [
        [host, "/proj"],
        [host, "/proj"],
      ]);
    }

    // 3. A rejected request does not stall the chain.
    {
      let attempts = 0;
      const host = {
        mkdirp(): void {},
        writeFile(): void {},
      } as unknown as IBootResult["host"];
      const api = {
        async plugin(): Promise<ITtscResult> {
          return envelope({});
        },
        async build(): Promise<ITtscResult> {
          return envelope({ result: compilePayload({}) });
        },
      } as unknown as IBootResult["api"];
      const service = createWorkerCompilerService(
        {
          bootTtsc: async () => {
            if (++attempts === 1) throw new Error("fetch failed before runtime");
            return { api, host };
          },
          parseResult: <T>(result: ITtscResult): T | null =>
            JSON.parse(result.result) as T,
        },
        { ...BASE_OPTIONS, typiaPlugin: false, lintPlugin: false },
      );
      await assert.rejects(
        service.installDependencies({ packages: [], pack: null } as never),
        /fetch failed before runtime/,
      );
      const next = await service.compile({ source: "export const a = 1;" });
      assert.equal(next.type, "success");
      assert.equal(attempts, 2, "the next request retried the pre-runtime boot");
    }
  };
