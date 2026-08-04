import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import {
  PLUGIN_DESCRIPTOR_MAX_BUFFER_BYTES,
  PLUGIN_DESCRIPTOR_PROCESS_OPTIONS,
  PLUGIN_DESCRIPTOR_STATUS_FD,
  pluginDescriptorBoundaryEnvironment,
  pluginDescriptorProcessFailure,
} from "../../../../../packages/ttsc/lib/plugin/internal/descriptorProcessFailure.js";

/**
 * Verifies executable plugin-descriptor failures preserve their real cause.
 *
 * Node attaches the configured termination signal to a max-buffer error, so
 * checking the signal first would hide an output overflow behind an apparent
 * external kill. The loader imposes no deadline, so an `ETIMEDOUT` can only
 * arrive from outside and must read as the external termination it is.
 *
 * 1. Classify output overflow, spawn, signal, and exit failures.
 * 2. Assert the process error code takes precedence over its shared signal.
 * 3. Recognize the runtime child's private overflow status and boundary env.
 * 4. Bound the non-zero stderr suffix and accept a successful result.
 */
export const test_plugin_descriptor_process_failures_are_classified_by_cause =
  (): void => {
    const request = "/project/plugin.ts";
    const overflow = pluginDescriptorProcessFailure(
      processResult({
        error: processError("ENOBUFS"),
        signal: PLUGIN_DESCRIPTOR_PROCESS_OPTIONS.killSignal,
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

    const nestedOverflow = pluginDescriptorProcessFailure(
      processResult({
        output: [null, "", "", "ENOBUFS"],
        status: 1,
      }),
      request,
    );
    assert.match(
      nestedOverflow?.message ?? "",
      /exceeded the 16 MiB process output limit/,
    );
    assert.doesNotMatch(nestedOverflow?.message ?? "", /exit code 1/);

    // No deadline is published: the loader runs the user's own descriptor and
    // does not decide how long that is allowed to take.
    assert.deepEqual(pluginDescriptorBoundaryEnvironment(), {
      TTSC_TTSX_EVALUATOR_MAX_BUFFER_BYTES: String(
        PLUGIN_DESCRIPTOR_MAX_BUFFER_BYTES,
      ),
      TTSC_TTSX_EVALUATOR_STATUS_FD: String(PLUGIN_DESCRIPTOR_STATUS_FD),
    });

    assertOverflowCannotBeDefeatedBySigtermHandler();

    assert.equal(
      pluginDescriptorProcessFailure(processResult({ status: 0 }), request),
      undefined,
    );
  };

/**
 * The loader's `SIGKILL` still has to be unignorable, because the output cap is
 * enforced by killing the child and a descriptor that installs a `SIGTERM`
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
      ].join(""),
    ],
    {
      ...PLUGIN_DESCRIPTOR_PROCESS_OPTIONS,
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
    stdout: string;
    output: readonly (string | null)[];
  }>,
): {
  error?: Error;
  output?: readonly (string | null)[];
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
