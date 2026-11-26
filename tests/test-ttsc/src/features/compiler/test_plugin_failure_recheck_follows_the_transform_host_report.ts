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
 * 3. Assert only matching process and command receipts establish completion,
 *    diagnostic content survives and earlier phases cannot supply completion.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises actual normalization, receipt admission, native argv fingerprinting and phase merging; accepting an error, another PID/command, a bare token or a preceding phase's proof fails an assertion.
 * @evidence contracts/testing.md#independent-expectations The protocol requires a fresh token, actual spawned PID and SHA-256 of NUL-terminated UTF-8 argv. Digest constants were derived independently with Python hashlib; authored LF and CRLF strings specify preserved output without depending on the admission implementation.
 * @evidence contracts/testing.md#distinguishing-cases Covers pretty/plain/plugin errors, warning/empty/panic reports, both streams, repeated/unterminated receipts, bare/stale/embedded tokens, malformed/missing fields, another PID/command, empty argv versus an empty argument, argument boundaries and Unicode. The E2E owns producer PID/argv wiring and secondary Program/descendant failures.
 * @evidence contracts/testing.md#execution-ownership This source unit calls maintained operations with authored output and launches no producer.
 */
export const test_plugin_failure_recheck_follows_the_transform_host_report =
  () => {
    const token = "ttsc:diagnostics-complete:current";
    const invocation = { pid: 421, args: ["check", "--cwd=/project"] };
    const command =
      "67c9be8b3d5e4c616cd5496e55b70951b9ab5829668443f2d65f6b28100f39ba";
    const receipt = "\n" + token + " " + JSON.stringify({ pid: 421, command });
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
      const partial = PluginFailureDiagnostics.consumeHostReport(
        host,
        token,
        invocation,
      );
      assert.equal(partial.typeScriptDiagnosticsReported, undefined, stderr);
      assert.equal(partial.stderr, stderr);
      assert.deepEqual(partial.diagnostics, host.diagnostics);
      for (const newline of ["\n", "\r\n"]) {
        const text = stderr === "" ? "" : stderr + newline;
        const complete = PluginFailureDiagnostics.consumeHostReport(
          { ...host, stderr: text + receipt + newline },
          token,
          invocation,
        );
        assert.equal(complete.typeScriptDiagnosticsReported, true, stderr);
        assert.equal(complete.stderr, text);
        assert.equal(complete.status, 2);
        assert.deepEqual(complete.diagnostics, host.diagnostics);
      }
    }
    for (const text of [receipt + "\n" + receipt + "\n", receipt]) {
      const complete = PluginFailureDiagnostics.consumeHostReport(
        normalizeBuildOutput({
          status: 2,
          stdout: text,
          stderr: "error HOST_EMIT: emission failed",
        }),
        token,
        invocation,
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
      const partial = PluginFailureDiagnostics.consumeHostReport(
        normalizeBuildOutput({ status: 2, stdout: "", stderr }),
        token,
        invocation,
      );
      assert.equal(partial.typeScriptDiagnosticsReported, undefined);
      assert.equal(partial.stderr, stderr);
    }
    for (const text of [
      token,
      "\n" + token + " {broken}\n",
      "\n" + token + " {truncated",
      "\n" + token + " " + JSON.stringify({ pid: 422, command }) + "\n",
      "\n" +
        token +
        " " +
        JSON.stringify({ pid: 421, command: "another-command" }) +
        "\n",
      "\n" + token + " " + JSON.stringify({ command }) + "\n",
      "\n" + token + " " + JSON.stringify({ pid: 421 }) + "\n",
    ]) {
      const partial = PluginFailureDiagnostics.consumeHostReport(
        normalizeBuildOutput({ status: 2, stdout: "", stderr: text }),
        token,
        invocation,
      );
      assert.equal(partial.typeScriptDiagnosticsReported, undefined, text);
      assert.equal(partial.stderr, "", text);
    }
    assert.equal(
      PluginFailureDiagnostics.commandKey([]),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    assert.equal(
      PluginFailureDiagnostics.commandKey([""]),
      "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d",
    );
    assert.equal(PluginFailureDiagnostics.commandKey(invocation.args), command);
    assert.equal(
      PluginFailureDiagnostics.commandKey([
        "check",
        "--cwd=C:/projects/\ud55c\uae00 \ud83d\ude42",
      ]),
      "945a173e3ad4bb06cea7207530d10be8d8f9e6e1dae70a9f3424a13c4772c8b4",
    );
    assert.notEqual(
      PluginFailureDiagnostics.commandKey(["ab", "c"]),
      PluginFailureDiagnostics.commandKey(["a", "bc"]),
    );
    const changedContext = PluginFailureDiagnostics.consumeHostReport(
      normalizeBuildOutput({ status: 2, stdout: "", stderr: receipt }),
      token,
      { ...invocation, context: ["changed-compiler-options"] },
    );
    assert.equal(changedContext.typeScriptDiagnosticsReported, undefined);
    const original =
      "error TS2322: authored failure\n  details before and after\n";
    const raw = PluginFailureDiagnostics.consumeHostReport(
      {
        status: 2,
        stdout: "",
        stderr:
          "error TS2322: authored failure\n  details before" +
          receipt +
          "\n and after\n",
      },
      token,
      invocation,
    );
    assert.equal(raw.stderr, original);
    const parsed = normalizeBuildOutput(raw);
    assert.equal(
      parsed.diagnostics[0]?.messageText,
      "authored failure\n  details before and after",
    );
    const fromStdout = normalizeBuildOutput(
      PluginFailureDiagnostics.consumeHostReport(
        {
          status: 2,
          stdout: "error TS2322: stdout failure\n",
          stderr: receipt + "\n",
        },
        token,
        invocation,
      ),
    );
    const merged = appendBuildOutput(
      { status: 0, stdout: "check output\n", stderr: "", diagnostics: [] },
      fromStdout,
    );
    assert.equal(merged.stdout, "check output\n");
    assert.equal(merged.stderr, "error TS2322: stdout failure\n");
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
