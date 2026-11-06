import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

/**
 * Verifies optional cache explanations cannot fail the caller after pipe close.
 * A caught stream write can still deliver an unhandled asynchronous error.
 *
 * 1. Start the actual reporter in an ordinary source actor with an IPC barrier.
 * 2. Keep stderr readable or close its reader before permitting the report.
 * 3. Require the same result/exit and exact enabled or disabled diagnostics.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual child reporter calls run after the parent confirms native stderr pipe closure or retains its reader. The original product-result stdout and zero exit must survive, while normal enabled output must contain the literal structured decision and disabled output stays empty.
 * @evidence contracts/testing.md#independent-expectations Authored product-result text, zero exit and the literal reused/source-한글 decision define the oracle independently of cache keys or logger output. IPC readiness plus the real pipe close event establishes ordering without a timing guess.
 * @evidence contracts/testing.md#distinguishing-cases Disabled, enabled-readable and enabled-closed channels separate ordinary quiet behavior, Unicode output and asynchronous pipe-error refusal. A ten-second guard bounds a stuck actor but never determines the pipe/report ordering; this test does not claim to inject every native IO error.
 * @evidence contracts/testing.md#execution-ownership The named source unit starts three ordinary Node actors importing maintained source, without compiler, installation, product host or foreign-method replacement. Every actor is joined and an unfinished child is terminated/joined in finally; IPC, stdout/stderr handles and timer follow that lifetime.
 */
export async function test_runtime_cache_explanation_preserves_execution_after_stderr_closes(): Promise<void> {
  for (const [explain, closeReader] of [
    [undefined, false],
    ["1", false],
    ["1", true],
  ] as const) {
    const actor = spawn(
      process.execPath,
      [
        "--import",
        new URL(
          "../../../../../config/register-unit-loader.mjs",
          import.meta.url,
        ).href,
        fileURLToPath(
          new URL(
            "../../internal/runtime-cache-explanation-actor.ts",
            import.meta.url,
          ),
        ),
      ],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: {
          ...process.env,
          NODE_OPTIONS: undefined,
          TTSC_EXPLAIN_CACHE: explain,
          TTSC_E2E_TRACE: undefined,
        },
      },
    );
    let stdout = "";
    let stderr = "";
    actor.stdout!.setEncoding("utf8").on("data", (part) => {
      stdout += part;
    });
    actor.stderr!.setEncoding("utf8").on("data", (part) => {
      stderr += part;
    });
    const closed = once(actor, "close");
    let timedOut = false;
    const guard = setTimeout(() => {
      timedOut = true;
      actor.kill();
    }, 10_000);
    try {
      const [ready] = await Promise.race([
        once(actor, "message"),
        closed.then(() => {
          throw new Error("reporter actor exited before readiness");
        }),
      ]);
      assert.equal(ready, "ready");
      if (closeReader) {
        const readerClosed = once(actor.stderr!, "close");
        actor.stderr!.destroy();
        await readerClosed;
      }
      actor.send("report");
      const [code, signal] = await closed;
      assert.equal(timedOut, false);
      assert.equal(signal, null);
      assert.equal(code, 0);
      assert.equal(stdout, "product-result\n");
      assert.equal(
        stderr,
        explain === "1" && !closeReader
          ? 'ttsx cache: {"outcome":"reused","project":"source-한글"}\n'
          : "",
      );
    } finally {
      clearTimeout(guard);
      if (
        actor.pid !== undefined &&
        actor.exitCode === null &&
        actor.signalCode === null
      ) {
        actor.kill();
        await closed;
      }
    }
  }
}
