import { BootTtscWorkerTerminationError, type ITtscResult } from "@ttsc/wasm";
import assert from "node:assert/strict";

import {
  type IWorkerCompilerDeps,
  createWorkerCompilerService,
} from "../../../../packages/playground/lib/src/compiler/internal/createWorkerCompilerService.js";

/**
 * Verifies worker compiler boot caching: terminal runtime failures never retry.
 *
 * A compile request that reaches a post-`go.run` failure must keep that
 * rejection cached until the UI replaces the Worker. Clearing it like a
 * pre-runtime failure would call `bootTtsc` again in the same Worker and expose
 * a readiness bridge to the stale Go runtime.
 *
 * 1. Reject two compiles with one terminal boot error and assert one boot call.
 * 2. Reject two compiles with a transient error and assert each call retries.
 * 3. Confirm both error shapes remain visible to the compiler caller.
 */
export const test_worker_compiler_caches_terminal_boot_failures =
  async (): Promise<void> => {
    const terminal = new BootTtscWorkerTerminationError(
      "ttscTerminalCompiler",
      new Error("readiness timed out"),
    );
    let terminalCalls = 0;
    const terminalService = createWorkerCompilerService(
      dependencies(async () => {
        terminalCalls++;
        throw terminal;
      }),
      compilerOptions("ttscTerminalCompiler"),
    );

    const terminalFirst = await terminalService.compile({
      source: "export const value = 1;",
    });
    const terminalSecond = await terminalService.compile({
      source: "export const value = 2;",
    });
    assert.equal(terminalCalls, 1);
    assert.equal(terminalFirst.type, "error");
    assert.equal(terminalSecond.type, "error");
    assert.match(
      errorMessage(terminalFirst.value),
      /terminate and replace this Worker/,
    );
    assert.equal(
      errorMessage(terminalSecond.value),
      errorMessage(terminalFirst.value),
    );

    let transientCalls = 0;
    const transientService = createWorkerCompilerService(
      dependencies(async () => {
        transientCalls++;
        throw new Error("fetch failed before runtime");
      }),
      compilerOptions("ttscTransientCompiler"),
    );
    const transientFirst = await transientService.compile({
      source: "export const value = 1;",
    });
    const transientSecond = await transientService.compile({
      source: "export const value = 2;",
    });
    assert.equal(transientCalls, 2);
    assert.equal(transientFirst.type, "error");
    assert.equal(transientSecond.type, "error");
    assert.match(errorMessage(transientFirst.value), /fetch failed/);
    assert.match(errorMessage(transientSecond.value), /fetch failed/);
  };

function compilerOptions(apiName: string) {
  return {
    apiName,
    wasmUrl: "http://local/compiler.wasm",
    typiaPlugin: false as const,
    lintPlugin: false as const,
  };
}

function dependencies(
  bootTtsc: IWorkerCompilerDeps["bootTtsc"],
): IWorkerCompilerDeps {
  return {
    bootTtsc,
    parseResult: <T>(_result: ITtscResult): T | null => null,
  };
}

function errorMessage(value: unknown): string {
  assert.ok(value && typeof value === "object" && "message" in value);
  return String((value as { message: unknown }).message);
}
