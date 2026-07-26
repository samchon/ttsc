import assert from "node:assert/strict";

import { configEvaluatorProcessFailure } from "../../../../../packages/lint/lib/internal/configEvaluatorFailure.js";

/**
 * Verifies isolated lint-config process failures preserve their real cause.
 *
 * Node attaches `SIGTERM` to both timeout and max-buffer errors. Treating the
 * signal first made those distinct failures indistinguishable and falsely
 * blamed the timeout for excessive output.
 *
 * 1. Classify timeout, output overflow, spawn, signal, and exit failures.
 * 2. Assert process error codes take precedence over their shared signal.
 * 3. Assert evaluator stderr is bounded and a successful result has no error.
 */
export const test_config_evaluator_process_failures_are_classified_by_cause =
  (): void => {
    const configPath = "/project/lint.config.ts";
    const timeout = configEvaluatorProcessFailure(
      processResult({
        error: processError("ETIMEDOUT"),
        signal: "SIGTERM",
      }),
      configPath,
    );
    assert.match(timeout?.message ?? "", /timed out after 60 seconds/);
    assert.doesNotMatch(timeout?.message ?? "", /killed by signal/);

    const overflow = configEvaluatorProcessFailure(
      processResult({
        error: processError("ENOBUFS"),
        signal: "SIGTERM",
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

    assert.equal(
      configEvaluatorProcessFailure(processResult({ status: 0 }), configPath),
      undefined,
    );
  };

function processError(code: string): Error {
  return Object.assign(new Error(`spawnSync node ${code}`), { code });
}

function processResult(
  input: Partial<{
    error: Error;
    signal: NodeJS.Signals;
    status: number;
    stderr: string;
  }>,
): {
  error?: Error;
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
