import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import {
  CONFIG_EVALUATOR_MAX_BUFFER,
  CONFIG_EVALUATOR_PROCESS_OPTIONS,
  CONFIG_EVALUATOR_STATUS_FD,
  configEvaluatorBoundaryEnvironment,
  configEvaluatorProcessFailure,
} from "../../../../../packages/lint/lib/internal/configEvaluatorFailure.js";

/**
 * Verifies isolated lint-config process failures preserve their real cause.
 *
 * Node attaches the configured termination signal to a max-buffer error, so
 * treating the signal first made an output overflow indistinguishable from an
 * external kill. The evaluator imposes no deadline at all, so `spawnSync` has
 * no mechanism left to report one and the classifier carries no timeout arm.
 *
 * 1. Classify output overflow, spawn, signal, and exit failures.
 * 2. Assert the process error code takes precedence over its shared signal.
 * 3. Recognize the runtime child's private overflow status and boundary env.
 * 4. Assert evaluator stderr is bounded and a successful result has no error.
 */
export const test_config_evaluator_process_failures_are_classified_by_cause =
  (): void => {
    const configPath = "/project/lint.config.ts";
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
    assert.doesNotMatch(signal?.message ?? "", /timeout|timed out/i);

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

    // No deadline is published: the evaluator runs the user's own config and
    // does not decide how long that is allowed to take.
    assert.deepEqual(configEvaluatorBoundaryEnvironment(), {
      TTSC_TTSX_EVALUATOR_MAX_BUFFER_BYTES: String(CONFIG_EVALUATOR_MAX_BUFFER),
      TTSC_TTSX_EVALUATOR_STATUS_FD: String(CONFIG_EVALUATOR_STATUS_FD),
    });

    assertOverflowCannotBeDefeatedBySigtermHandler();

    assert.equal(
      configEvaluatorProcessFailure(processResult({ status: 0 }), configPath),
      undefined,
    );
  };

/**
 * The evaluator's `SIGKILL` still has to be unignorable, because the output cap
 * is enforced by killing the child and a config that installs a `SIGTERM`
 * handler would otherwise survive its own overflow.
 */
function assertOverflowCannotBeDefeatedBySigtermHandler(): void {
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      [
        'process.on("SIGTERM", () => {});',
        'setInterval(() => process.stdout.write("x".repeat(4096)), 0);',
        // A self-exit, so a broken kill fails this assertion in seconds
        // instead of blocking the event loop forever: `spawnSync` is
        // synchronous, so no test-harness timer could rescue the lane.
        "setTimeout(() => process.exit(0), 30_000);",
      ].join(""),
    ],
    {
      ...CONFIG_EVALUATOR_PROCESS_OPTIONS,
      encoding: "utf8",
      maxBuffer: 1_024,
      windowsHide: true,
    },
  );
  assert.equal(
    (result.error as NodeJS.ErrnoException | undefined)?.code,
    "ENOBUFS",
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
