import assert from "node:assert/strict";

import { configEvaluatorProcessFailure } from "../../../../../packages/lint/src/internal/configEvaluatorFailure";

/**
 * Verifies isolated lint-config process failures preserve their real cause.
 *
 * The evaluator writes the child's own output straight to this process's
 * stderr, so by the time a failure is classified the user has already seen
 * whatever the config said. What is left to report is how the process ended,
 * and the three endings are genuinely different: it never launched, something
 * outside killed it, or it ran and chose a non-zero status.
 *
 * Nothing here is bounded. A deadline and an output ceiling both used to live
 * on this path, and both were the compiler deciding — on numbers nobody chose
 * for the machine running the build — that a user's own config had taken too
 * long or said too much. The absence of those branches is part of the contract
 * this pins: a killed evaluation must read as the external kill it is, never as
 * a limit this toolchain imposed.
 *
 * 1. Classify a spawn failure, an external signal, and a non-zero exit.
 * 2. Assert none of them is described as a timeout or an output limit.
 * 3. Assert a clean exit produces no error at all.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored configEvaluatorProcessFailure classifies supplied spawn error, SIGKILL, exit 2 and clean status, asserting the cause text and absence of fabricated timeout or output-limit diagnoses.
 * @evidence contracts/testing.md#independent-expectations Node process outcomes define distinct failure categories; literal ENOENT, SIGKILL and exit-code messages are expected independently of the classifier.
 * @evidence contracts/testing.md#distinguishing-cases Spawn failure, external signal, nonzero and unavailable exit status, and successful exit distinguish all branches. Combined outcomes require spawn errors to precede signals and signals to precede exit codes; output and time limits must never be invented.
 * @evidence contracts/testing.md#execution-ownership This named source unit invokes only the classifier with process-result values, without starting an evaluator or building a host. Descriptor evaluator failure cases retain the real child-process connection.
 */
export function test_config_evaluator_process_failures_are_classified_by_cause(): void {
    const configPath = "/project/lint.config.ts";

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

    const exit = configEvaluatorProcessFailure(
      processResult({ status: 2 }),
      configPath,
    );
    assert.match(exit?.message ?? "", /failed with exit code 2/);

    assert.match(
      configEvaluatorProcessFailure(processResult({}), configPath)?.message ?? "",
      /failed with exit code null/,
    );
    assert.match(
      configEvaluatorProcessFailure(
        processResult({ error: processError("ENOENT"), signal: "SIGKILL", status: 2 }),
        configPath,
      )?.message ?? "",
      /failed to spawn ttsx/,
    );
    assert.match(
      configEvaluatorProcessFailure(
        processResult({ signal: "SIGKILL", status: 2 }),
        configPath,
      )?.message ?? "",
      /killed by signal SIGKILL/,
    );

    // A kill this process did not order is reported as what it is. Neither a
    // deadline nor an output ceiling exists to be blamed for it.
    for (const failure of [spawn, signal, exit]) {
      assert.doesNotMatch(failure?.message ?? "", /timed out|timeout/i);
      assert.doesNotMatch(failure?.message ?? "", /output limit|MiB/i);
    }

    assert.equal(
      configEvaluatorProcessFailure(processResult({ status: 0 }), configPath),
      undefined,
    );
  }

function processError(code: string): Error {
  return Object.assign(new Error(`spawnSync node ${code}`), { code });
}

function processResult(
  input: Partial<{
    error: Error;
    signal: NodeJS.Signals;
    status: number;
  }>,
): {
  error?: Error;
  signal: NodeJS.Signals | null;
  status: number | null;
} {
  return {
    signal: null,
    status: null,
    ...input,
  };
}
