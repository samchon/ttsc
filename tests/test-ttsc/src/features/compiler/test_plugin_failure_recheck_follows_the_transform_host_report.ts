import assert from "node:assert/strict";

import { PluginFailureDiagnostics } from "../../../../../packages/ttsc/src/compiler/internal/build/PluginFailureDiagnostics";
import { appendBuildOutput } from "../../../../../packages/ttsc/src/compiler/internal/build/appendBuildOutput";
import { normalizeBuildOutput } from "../../../../../packages/ttsc/src/compiler/internal/build/normalizeBuildOutput";

/**
 * Verifies recovery requires a complete transform-host report, rather than an
 * error printed before checking. Completion belongs to the current producer.
 *
 * 1. Normalize failed host reports with and without a private completion token.
 * 2. Consume that invocation's token and merge separate check/build results.
 * 3. Assert only exact token lines establish completion, ordinary output and
 *    diagnostic identity survive, and earlier phases cannot supply completion.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises actual normalization, completion admission and phase merging; inferring completeness from errors, accepting another invocation's token or leaking a preceding phase's proof fails an assertion.
 * @evidence contracts/testing.md#independent-expectations The protocol requires the complete invocation token on its own line after all Program diagnostics; diagnostic severity and partial error text carry no such guarantee. Authored LF and CRLF strings independently specify preserved output.
 * @evidence contracts/testing.md#distinguishing-cases Covers pretty, plain and plugin errors, warning-only and empty reports, panic text, stdout and stderr, repeated and unterminated tokens, stale tokens and embedded text. The E2E owns actual host acknowledgement and the emitting/no-emit branches.
 * @evidence contracts/testing.md#execution-ownership This source unit calls maintained operations with authored output and launches no producer.
 */
export const test_plugin_failure_recheck_follows_the_transform_host_report =
  () => {
    const token = "ttsc:diagnostics-complete:current";
    const reported = [
      "src/main.ts:3:14 - error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/main.ts(3,14): error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/main.ts:3:14 - error TYPIA_ASSERT: Type is not supported.",
      "error HOST_SETUP: failed before loading the Program",
      "warning TS6133: 'unused' is declared but its value is never read.",
      "panic: transform host crashed\n\ngoroutine 1 [running]:\nmain.main()\n\t/plugin/main.go:29 +0x24",
      "",
    ];
    for (const stderr of reported) {
      const host = normalizeBuildOutput({ status: 2, stdout: "", stderr });
      const partial = PluginFailureDiagnostics.consumeTransformHostReport(
        host,
        token,
      );
      assert.equal(partial.typeScriptDiagnosticsReported, undefined, stderr);
      assert.equal(partial.stderr, stderr);
      assert.equal(partial.diagnostics, host.diagnostics);
      for (const newline of ["\n", "\r\n"]) {
        const text = stderr === "" ? "" : stderr + newline;
        const complete = PluginFailureDiagnostics.consumeTransformHostReport(
          { ...host, stderr: text + token + newline },
          token,
        );
        assert.equal(complete.typeScriptDiagnosticsReported, true, stderr);
        assert.equal(complete.stderr, text);
        assert.equal(complete.status, 2);
        assert.equal(complete.diagnostics, host.diagnostics);
      }
    }
    for (const text of [token + "\n" + token + "\n", token]) {
      const complete = PluginFailureDiagnostics.consumeTransformHostReport(
        normalizeBuildOutput({
          status: 2,
          stdout: text,
          stderr: "error HOST_EMIT: emission failed",
        }),
        token,
      );
      assert.equal(complete.typeScriptDiagnosticsReported, true);
      assert.equal(complete.stdout, "");
      assert.equal(complete.stderr, "error HOST_EMIT: emission failed");
    }
    for (const stderr of [
      "ttsc:diagnostics-complete:previous\n",
      "prefix " + token + "\n",
      token + " suffix\n",
    ]) {
      const partial = PluginFailureDiagnostics.consumeTransformHostReport(
        normalizeBuildOutput({ status: 2, stdout: "", stderr }),
        token,
      );
      assert.equal(partial.typeScriptDiagnosticsReported, undefined);
      assert.equal(partial.stderr, stderr);
    }
    const checked = {
      status: 0,
      stdout: "",
      stderr: "",
      diagnostics: [],
      typeScriptDiagnosticsReported: true as const,
    };
    const crashed = {
      status: 2,
      stdout: "",
      stderr: "panic: host failed",
      diagnostics: [],
    };
    assert.equal(
      appendBuildOutput(checked, crashed).typeScriptDiagnosticsReported,
      undefined,
    );
    assert.equal(
      appendBuildOutput(crashed, checked).typeScriptDiagnosticsReported,
      true,
    );
  };
