import assert from "node:assert/strict";

import { appendBuildOutput } from "../../../../../packages/ttsc/src/compiler/internal/build/appendBuildOutput";
import { PluginFailureDiagnostics } from "../../../../../packages/ttsc/src/compiler/internal/build/PluginFailureDiagnostics";
import type { RunBuildOptions } from "../../../../../packages/ttsc/src/compiler/internal/build/RunBuildOptions";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies phase merging preserves failures and cannot restore lost witnesses.
 *
 * Content and physical witnesses have independent authority. An input declared
 * by both phases needs agreement in each dimension; an undeclared phase cannot
 * revoke it. Later emission owns provenance even when its answer is unavailable.
 *
 * 1. Merge successful and failing phases and inspect ordered reports and streams.
 * 2. Contrast absent and explicitly empty later emission metadata.
 * 3. Compare equal, absent, null and conflicting input witnesses independently.
 * 4. Preserve sticky witness loss and the plugin-failure recovery gate, seed
 *    diagnostic, original status and filtered-batch identity.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual appendBuildOutput and PluginFailureDiagnostics operations with authored records and options; observes phase merging, recovery admission, process-report seeding, original failure status, null-result identity and input preservation.
 * @evidence contracts/testing.md#independent-expectations Literal expected records follow the phase-result contract: right failure wins, earlier failure survives right success, only later emission owns provenance, agreeing declaring phases retain proof, null records absence and missing keys provide none. Native-looking input strings are opaque producer data, not filesystem claims.
 * @evidence contracts/testing.md#distinguishing-cases Phase success/failure, emission and witness distinctions remain separate from format/skip/terminal admission and emit-neutral controls. Recovery contrasts stderr/stdout precedence, whitespace/empty exit fallback, existing reports and null batches while preserving ordered reports and sticky witness loss.
 * @evidence contracts/testing.md#execution-ownership The feature export directly calls production-used source operations in process. Supplied records do not certify native diagnostic acquisition, plugin dispatch, check-failure early return, emission branches or transport; no compiler, host or child process is invoked by this body.
 */
export function test_append_build_output_preserves_phase_results_and_sticky_witness_loss(): void {
  const failures: Error[] = [];
  const check = (name: string, run: () => void): void => {
    try { run(); }
    catch (cause) { failures.push(new Error(name, { cause })); }
  };
  const phase = (fields: Partial<TtscBuildResult> = {}): TtscBuildResult => ({
    diagnostics: [], status: 0, stdout: "", stderr: "", ...fields,
  });

  check("status, diagnostics and streams", () => {
    const leftDiagnostic = { file: null, category: "error" as const, code: 101, messageText: "first" };
    const rightDiagnostic = { file: null, category: "warning" as const, code: 202, messageText: "second" };
    const combined = appendBuildOutput(
      phase({ status: 3, stdout: "left-out", stderr: "left-error", diagnostics: [leftDiagnostic] }),
      phase({ status: 7, stdout: "/right-out", stderr: "/right-error", diagnostics: [rightDiagnostic] }),
    );
    assert.equal(combined.status, 7);
    assert.deepEqual(combined.diagnostics, [leftDiagnostic, rightDiagnostic]);
    assert.equal(combined.diagnostics[0], leftDiagnostic);
    assert.equal(combined.diagnostics[1], rightDiagnostic);
    assert.equal(combined.stdout, "left-out/right-out");
    assert.equal(combined.stderr, "left-error/right-error");
    assert.equal(appendBuildOutput(phase({ status: 3 }), phase()).status, 3);
    assert.equal(appendBuildOutput(phase(), phase()).status, 0);
    const failure = appendBuildOutput(phase({ stdout: "visible" }), phase({ status: 7, stdout: "-failure" }));
    assert.equal(failure.stdout, "");
    assert.equal(failure.stderr, "visible-failure");
    const success = appendBuildOutput(phase({ stdout: "visible" }), phase());
    assert.equal(success.stdout, "visible");
    assert.equal(success.stderr, "");
  });

  check("later emission ownership", () => {
    const earlier = phase({ emittedFiles: ["early.js"], emittedSources: { "early.js": ["source.ts"] }, emittedSourceProofFailures: { "early.js": "earlier refusal" }, processCompletedNormally: true });
    const unavailable = appendBuildOutput(earlier, phase());
    assert.deepEqual(unavailable.emittedFiles, ["early.js"]);
    assert.equal(unavailable.emittedSources, undefined);
    assert.equal(unavailable.emittedSourceProofFailures, undefined);
    assert.equal(unavailable.processCompletedNormally, undefined);
    const empty = appendBuildOutput(earlier, phase({ emittedFiles: [], emittedSources: {}, processCompletedNormally: false }));
    assert.deepEqual(empty.emittedFiles, []);
    assert.deepEqual(empty.emittedSources, {});
    assert.equal(empty.processCompletedNormally, false);
    const later = appendBuildOutput(earlier, phase({ emittedFiles: ["late.js"], emittedSources: { "late.js": [] }, emittedSourceProofFailures: { "late.js": "unknown producer" }, processCompletedNormally: true }));
    assert.deepEqual(later.emittedFiles, ["late.js"]);
    assert.deepEqual(later.emittedSources, { "late.js": [] });
    assert.deepEqual(later.emittedSourceProofFailures, { "late.js": "unknown producer" });
    assert.equal(later.processCompletedNormally, true);
  });

  const left = phase({ hostInputs: ["equal", "content-conflict", "physical-conflict", "missing", "absent", "left-only"], hostInputHashes: { equal: "same", "content-conflict": "old", "physical-conflict": "same", missing: "known", absent: null, "left-only": "left" }, hostInputRealpaths: { equal: "/same", "content-conflict": "/same", "physical-conflict": "/old", missing: "/known", absent: null, "left-only": "/left" } });
  const right = phase({ hostInputs: ["equal", "content-conflict", "physical-conflict", "missing", "absent", "right-only"], hostInputHashes: { equal: "same", "content-conflict": "new", "physical-conflict": "same", absent: null, "right-only": "right" }, hostInputRealpaths: { equal: "/same", "content-conflict": "/same", "physical-conflict": "/new", absent: null, "right-only": "/right" }, observationsComplete: false });
  check("union and independent witnesses", () => {
    const merged = appendBuildOutput(left, right);
    assert.deepEqual(merged.hostInputs, ["equal", "content-conflict", "physical-conflict", "missing", "absent", "left-only", "right-only"]);
    assert.deepEqual({ ...merged.hostInputHashes }, { equal: "same", "physical-conflict": "same", absent: null, "left-only": "left", "right-only": "right" });
    assert.deepEqual({ ...merged.hostInputRealpaths }, { equal: "/same", "content-conflict": "/same", absent: null, "left-only": "/left", "right-only": "/right" });
    assert.equal(Object.hasOwn(merged.hostInputHashes!, "absent"), true);
    assert.equal(Object.hasOwn(merged.hostInputHashes!, "missing"), false);
    assert.equal(merged.observationsComplete, false);
  });
  check("third phase cannot restore loss", () => {
    const merged = appendBuildOutput(left, right);
    const third = appendBuildOutput(merged, phase({ hostInputs: ["content-conflict", "physical-conflict", "missing"], hostInputHashes: { "content-conflict": "new", "physical-conflict": "same", missing: "known" }, hostInputRealpaths: { "content-conflict": "/same", "physical-conflict": "/new", missing: "/known" } }));
    assert.equal(Object.hasOwn(third.hostInputHashes!, "content-conflict"), false);
    assert.equal(Object.hasOwn(third.hostInputRealpaths!, "physical-conflict"), false);
    assert.equal(Object.hasOwn(third.hostInputHashes!, "missing"), false);
    assert.equal(Object.hasOwn(third.hostInputRealpaths!, "missing"), false);
    assert.equal(third.hostInputHashes!["physical-conflict"], "same");
    assert.equal(third.hostInputRealpaths!["content-conflict"], "/same");
    assert.equal(third.observationsComplete, false);
  });
  check("undeclared and empty phases", () => {
    const unchanged = appendBuildOutput(left, phase());
    assert.deepEqual({ ...unchanged.hostInputHashes }, left.hostInputHashes);
    assert.deepEqual({ ...unchanged.hostInputRealpaths }, left.hostInputRealpaths);
    assert.equal(unchanged.observationsComplete, undefined);
    const undeclared = appendBuildOutput(phase(), phase());
    assert.equal(Object.hasOwn(undeclared, "hostInputs"), false);
    const empty = appendBuildOutput(phase({ hostInputs: [] }), phase());
    assert.deepEqual(empty.hostInputs, []);
    assert.deepEqual({ ...empty.hostInputHashes }, {});
    assert.deepEqual({ ...empty.hostInputRealpaths }, {});
  });
  const recoveryModes: readonly [string, RunBuildOptions, boolean][] = [
    ["ordinary", {}, true],
    ["format", { format: true }, false],
    ["format disabled", { format: false }, true],
    ["skip diagnostics", { skipDiagnosticsCheck: true }, false],
    ["skip disabled", { skipDiagnosticsCheck: false }, true],
    ["terminal", { passthrough: ["--showConfig"] }, false],
    ["terminal disabled", { passthrough: ["--showConfig", "false"] }, true],
    ["emit", { emit: true }, true],
    ["no emit", { emit: false }, true],
  ];
  for (const [name, options, expected] of recoveryModes) check(`recovery gate/${name}`, () => {
    const before = structuredClone(options);
    assert.equal(PluginFailureDiagnostics.shouldCollect(options), expected);
    assert.deepEqual(options, before);
  });
  check("null recovery retains exact failure", () => {
    const failure = phase({ status: 3, stderr: "plugin failure" });
    assert.equal(PluginFailureDiagnostics.append(failure, null), failure);
    assert.deepEqual(failure.diagnostics, []);
  });
  const recovered = { file: null, category: "error" as const, code: 2322, messageText: "recovered type error" };
  const fallback = phase({ status: 7, diagnostics: [recovered], stdout: "fallback-out", stderr: "fallback-error" });
  for (const [name, stdout, stderr, message, expectedOut, expectedError] of [
    ["stderr precedence", "ignored", "  crash  ", "crash", "ignoredfallback-out", "  crash  fallback-error"],
    ["stdout fallback", "  crash-out  ", "", "crash-out", "  crash-out  fallback-out", "fallback-error"],
    ["whitespace stderr selects exit fallback", "not-selected", " \n ", "ttsc exited with status 3", "not-selectedfallback-out", " \n fallback-error"],
    ["empty streams", "", "", "ttsc exited with status 3", "fallback-out", "fallback-error"],
  ] as const) check(`recovery seed/${name}`, () => {
    const failure = phase({ status: 3, stdout, stderr });
    const before = structuredClone({ failure, fallback });
    const result = PluginFailureDiagnostics.append(failure, fallback);
    assert.deepEqual(result.diagnostics, [
      { category: "error", code: "TTSC_PROCESS", file: null, messageText: message },
      recovered,
    ]);
    assert.equal(result.diagnostics[1], recovered);
    assert.equal(result.status, 3);
    assert.equal(result.stdout, expectedOut);
    assert.equal(result.stderr, expectedError);
    assert.deepEqual({ failure, fallback }, before);
  });
  check("existing reports need no seed and retain recovery witnesses", () => {
    const original = { file: null, category: "error" as const, code: 2322, messageText: "original type error" };
    const failure = phase({
      status: 3, diagnostics: [original], stderr: "first-error/",
      hostInputs: ["policy-input"], hostInputHashes: { "policy-input": "old" },
      hostInputRealpaths: { "policy-input": "/same" },
    });
    const batch = phase({
      status: 7, diagnostics: [recovered], stderr: "second-error",
      hostInputs: ["policy-input"], hostInputHashes: { "policy-input": "new" },
      hostInputRealpaths: { "policy-input": "/same" }, observationsComplete: false,
      emittedFiles: ["recovered.js"], emittedSources: { "recovered.js": [] },
    });
    const before = structuredClone({ failure, batch });
    const result = PluginFailureDiagnostics.append(failure, batch);
    assert.deepEqual(result.diagnostics, [original, recovered]);
    assert.equal(result.diagnostics[0], original);
    assert.equal(result.diagnostics[1], recovered);
    assert.equal(result.status, 3);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "first-error/second-error");
    assert.deepEqual(result.hostInputs, ["policy-input"]);
    assert.equal(Object.hasOwn(result.hostInputHashes!, "policy-input"), false);
    assert.equal(result.hostInputRealpaths!["policy-input"], "/same");
    assert.equal(result.observationsComplete, false);
    assert.deepEqual(result.emittedFiles, ["recovered.js"]);
    assert.deepEqual(result.emittedSources, { "recovered.js": [] });
    assert.deepEqual({ failure, batch }, before);
  });
  if (failures.length) throw new AggregateError(failures, "Build phase merge distinctions failed");
}
