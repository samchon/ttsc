import assert from "node:assert/strict";

import { pluginDescriptorProcessFailure } from "../../../../../packages/ttsc/lib/plugin/internal/descriptorProcessFailure.js";

/**
 * Verifies executable plugin-descriptor failures preserve their real cause.
 *
 * Node attaches `SIGTERM` to both timeout and max-buffer errors. Checking the
 * signal first would hide whether descriptor setup stalled or emitted too much
 * output, while an unbounded stderr echo could replace one failure with a huge
 * parent diagnostic.
 *
 * 1. Classify timeout, output overflow, spawn, signal, and exit failures.
 * 2. Assert process error codes take precedence over their shared signal.
 * 3. Bound the non-zero stderr suffix and accept a successful result.
 */
export const test_plugin_descriptor_process_failures_are_classified_by_cause =
  (): void => {
    const request = "/project/plugin.ts";
    const timeout = pluginDescriptorProcessFailure(
      processResult({
        error: processError("ETIMEDOUT"),
        signal: "SIGTERM",
      }),
      request,
    );
    assert.match(timeout?.message ?? "", /timed out after 60 seconds/);
    assert.doesNotMatch(timeout?.message ?? "", /killed by signal/);

    const overflow = pluginDescriptorProcessFailure(
      processResult({
        error: processError("ENOBUFS"),
        signal: "SIGTERM",
      }),
      request,
    );
    assert.match(
      overflow?.message ?? "",
      /exceeded the 16 MiB process output limit/,
    );
    assert.doesNotMatch(overflow?.message ?? "", /killed by signal/);

    const spawn = pluginDescriptorProcessFailure(
      processResult({ error: processError("ENOENT") }),
      request,
    );
    assert.match(spawn?.message ?? "", /failed to launch ttsx/);
    assert.match(spawn?.message ?? "", /ENOENT/);

    const signal = pluginDescriptorProcessFailure(
      processResult({ signal: "SIGKILL" }),
      request,
    );
    assert.match(signal?.message ?? "", /killed by signal SIGKILL/);
    assert.doesNotMatch(signal?.message ?? "", /timeout/i);

    const exit = pluginDescriptorProcessFailure(
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
      request,
    );
    assert.match(exit?.message ?? "", /failed with exit code 2/);
    assert.doesNotMatch(exit?.message ?? "", /discarded one|discarded two/);
    assert.match(
      exit?.message ?? "",
      /kept three\nkept four\nkept five\nkept six\nkept seven$/,
    );

    const bounded = pluginDescriptorProcessFailure(
      processResult({ status: 3, stderr: "x".repeat(100_000) }),
      request,
    );
    assert.ok((bounded?.message.length ?? Number.POSITIVE_INFINITY) < 8_500);

    const stdout = pluginDescriptorProcessFailure(
      processResult({
        status: 4,
        stderr: "   ",
        stdout: "stdout-only descriptor cause",
      }),
      request,
    );
    assert.match(stdout?.message ?? "", /stdout-only descriptor cause$/);

    assert.equal(
      pluginDescriptorProcessFailure(processResult({ status: 0 }), request),
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
    stdout: string;
  }>,
): {
  error?: Error;
  signal: NodeJS.Signals | null;
  status: number | null;
  stderr: string | null;
  stdout: string | null;
} {
  return {
    signal: null,
    status: null,
    stderr: null,
    stdout: null,
    ...input,
  };
}
