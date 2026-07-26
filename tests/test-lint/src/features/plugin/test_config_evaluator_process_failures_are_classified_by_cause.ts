import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import {
  CONFIG_EVALUATOR_MAX_BUFFER,
  CONFIG_EVALUATOR_PROCESS_OPTIONS,
  CONFIG_EVALUATOR_STATUS_FD,
  CONFIG_EVALUATOR_TIMEOUT_MS,
  configEvaluatorBoundaryEnvironment,
  configEvaluatorProcessFailure,
} from "../../../../../packages/lint/lib/internal/configEvaluatorFailure.js";

/**
 * Verifies isolated lint-config process failures preserve their real cause.
 *
 * Node attaches the configured termination signal to both timeout and
 * max-buffer errors. Treating the signal first made those distinct failures
 * indistinguishable, while bounding only the outer ttsx wrapper left its
 * runtime child alive.
 *
 * 1. Classify timeout, output overflow, spawn, signal, and exit failures.
 * 2. Assert process error codes take precedence over their shared signal.
 * 3. Recognize the runtime child's private timeout/output status and boundary env.
 * 4. Assert evaluator stderr is bounded and a successful result has no error.
 */
export const test_config_evaluator_process_failures_are_classified_by_cause =
  (): void => {
    const configPath = "/project/lint.config.ts";
    const timeout = configEvaluatorProcessFailure(
      processResult({
        error: processError("ETIMEDOUT"),
        signal: CONFIG_EVALUATOR_PROCESS_OPTIONS.killSignal,
      }),
      configPath,
    );
    assert.match(timeout?.message ?? "", /timed out after 60 seconds/);
    assert.doesNotMatch(timeout?.message ?? "", /killed by signal/);

    const overflow = configEvaluatorProcessFailure(
      processResult({
        error: processError("ENOBUFS"),
        signal: CONFIG_EVALUATOR_PROCESS_OPTIONS.killSignal,
      }),
      configPath,
    );
    assert.match(overflow?.message ?? "", /exceeded the 16 MiB output limit/);
    assert.doesNotMatch(overflow?.message ?? "", /killed by signal/);

    const spawn = configEvaluatorProcessFailure(
      processResult({ error: processError("ENOENT") }),
      configPath,
    );
    assert.match(spawn?.message ?? "", /failed to spawn ttsx/);
    assert.match(spawn?.message ?? "", /ENOENT/);

    const signal = configEvaluatorProcessFailure(
      processResult({ signal: "SIGKILL" }),
      configPath,
    );
    assert.match(signal?.message ?? "", /killed by signal SIGKILL/);
    assert.doesNotMatch(signal?.message ?? "", /timeout/i);

    const exit = configEvaluatorProcessFailure(
      processResult({
        status: 2,
        stderr: [
          "discarded one",
          "discarded two",
          "kept three",
          "kept four",
          "kept five",
          "kept six",
          "kept seven",
        ].join("\n"),
      }),
      configPath,
    );
    assert.match(exit?.message ?? "", /failed with exit code 2/);
    assert.doesNotMatch(exit?.message ?? "", /discarded one|discarded two/);
    assert.match(
      exit?.message ?? "",
      /kept three\nkept four\nkept five\nkept six\nkept seven$/,
    );

    const bounded = configEvaluatorProcessFailure(
      processResult({ status: 3, stderr: "x".repeat(100_000) }),
      configPath,
    );
    assert.ok((bounded?.message.length ?? Number.POSITIVE_INFINITY) < 8_500);

    const nestedTimeout = configEvaluatorProcessFailure(
      processResult({
        output: [null, "", "", "ETIMEDOUT"],
        status: 1,
      }),
      configPath,
    );
    assert.match(nestedTimeout?.message ?? "", /timed out after 60 seconds/);
    assert.doesNotMatch(nestedTimeout?.message ?? "", /exit code 1/);

    const nestedOverflow = configEvaluatorProcessFailure(
      processResult({
        output: [null, "", "", "ENOBUFS"],
        status: 1,
      }),
      configPath,
    );
    assert.match(
      nestedOverflow?.message ?? "",
      /exceeded the 16 MiB output limit/,
    );
    assert.doesNotMatch(nestedOverflow?.message ?? "", /exit code 1/);

    assert.deepEqual(configEvaluatorBoundaryEnvironment(1_000), {
      TTSC_TTSX_EVALUATOR_DEADLINE_MS: String(
        1_000 + CONFIG_EVALUATOR_TIMEOUT_MS,
      ),
      TTSC_TTSX_EVALUATOR_MAX_BUFFER_BYTES: String(CONFIG_EVALUATOR_MAX_BUFFER),
      TTSC_TTSX_EVALUATOR_STATUS_FD: String(CONFIG_EVALUATOR_STATUS_FD),
    });

    assertTimeoutCannotBeDefeatedBySigtermHandler();

    assert.equal(
      configEvaluatorProcessFailure(processResult({ status: 0 }), configPath),
      undefined,
    );
  };

function assertTimeoutCannotBeDefeatedBySigtermHandler(): void {
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      [
        'process.on("SIGTERM", () => {});',
        "setTimeout(() => process.exit(0), 2_000);",
      ].join(""),
    ],
    {
      ...CONFIG_EVALUATOR_PROCESS_OPTIONS,
      encoding: "utf8",
      timeout: 50,
      windowsHide: true,
    },
  );
  assert.equal(
    (result.error as NodeJS.ErrnoException | undefined)?.code,
    "ETIMEDOUT",
  );
  assert.equal(result.signal, "SIGKILL");
}

function processError(code: string): Error {
  return Object.assign(new Error(`spawnSync node ${code}`), { code });
}

function processResult(
  input: Partial<{
    error: Error;
    signal: NodeJS.Signals;
    status: number;
    stderr: string;
    output: readonly (string | null)[];
  }>,
): {
  error?: Error;
  output?: readonly (string | null)[];
  signal: NodeJS.Signals | null;
  status: number | null;
  stderr: string | null;
} {
  return {
    signal: null,
    status: null,
    stderr: null,
    ...input,
  };
}
