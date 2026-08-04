import assert from "node:assert/strict";

import { pluginDescriptorProcessFailure } from "../../../../../packages/ttsc/lib/plugin/internal/descriptorProcessFailure.js";

/**
 * Verifies executable plugin-descriptor failures preserve their real cause.
 *
 * The loader writes the child's own output straight to this process's stderr,
 * so by the time a failure is classified the user has already seen whatever the
 * descriptor said. What is left to report is how the process ended, and the
 * three endings are genuinely different: it never launched, something outside
 * killed it, or it ran and chose a non-zero status.
 *
 * Nothing here is bounded. A deadline and an output ceiling both used to live
 * on this path, and both were the compiler deciding — on numbers nobody chose
 * for the machine running the build — that a user's own descriptor had taken
 * too long or said too much. The absence of those branches is part of the
 * contract this pins: a killed evaluation must read as the external kill it is,
 * never as a limit this toolchain imposed.
 *
 * 1. Classify a launch failure, an external signal, and a non-zero exit.
 * 2. Assert none of them is described as a timeout or an output limit.
 * 3. Assert a clean exit produces no error at all.
 */
export const test_plugin_descriptor_process_failures_are_classified_by_cause =
  (): void => {
    const request = "/project/plugin.ts";

    const launch = pluginDescriptorProcessFailure(
      processResult({ error: processError("ENOENT") }),
      request,
    );
    assert.match(launch?.message ?? "", /failed to launch ttsx/);
    assert.match(launch?.message ?? "", /ENOENT/);

    const signal = pluginDescriptorProcessFailure(
      processResult({ signal: "SIGKILL" }),
      request,
    );
    assert.match(signal?.message ?? "", /killed by signal SIGKILL/);

    const exit = pluginDescriptorProcessFailure(
      processResult({ status: 5 }),
      request,
    );
    assert.match(exit?.message ?? "", /failed with exit code 5/);

    // A kill this process did not order is reported as what it is. Neither a
    // deadline nor an output ceiling exists to be blamed for it.
    for (const failure of [launch, signal, exit]) {
      assert.doesNotMatch(failure?.message ?? "", /timed out|timeout/i);
      assert.doesNotMatch(failure?.message ?? "", /output limit|MiB/i);
    }

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
