import assert from "node:assert/strict";

import { CompilerTraceObservations } from "../../../../../packages/ttsc/src/compiler/internal/build/CompilerTraceObservations";

/**
 * Verifies the resolution trace an emitting run adds to its output is removed
 * again, and nothing else is.
 *
 * A runtime build asks its compiler for `--traceResolution` in the emitting run
 * instead of starting it a second time (samchon/ttsc#1859), so a failed check
 * would otherwise print thousands of resolution steps above its diagnostics.
 *
 * 1. Interleave the upstream resolver's trace messages, including a leading
 *    byte-order mark, with diagnostics, listed files and written-file reports.
 * 2. Strip the trace and compare with the output written without it.
 *
 * @evidence contracts/testing.md#behavioral-verification The production function processes output in the shape the compiler writes; the expected text is the same output without the trace lines.
 * @evidence contracts/testing.md#independent-expectations The trace lines are copied from a real `tsc --traceResolution` run of TypeScript 7.0.2 and the kept lines are the compiler's diagnostic and listing formats, so the expectation does not derive from the vocabulary under test.
 * @evidence contracts/testing.md#distinguishing-cases Resolution headers and results, existence and absence answers, package.json fields, real-path answers, a byte-order mark, a position diagnostic, a global diagnostic whose words resemble a trace message, a listed path, a written-file report and blank lines separate removed from kept lines.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls the pure function in process.
 */
export function test_compilertraceobservations_strip_only_the_resolution_trace(): void {
  const trace = [
    "\uFEFF======== Resolving module './f4' from 'C:/w/src/f5.ts'. ========",
    "Module resolution kind is not specified, using 'Bundler'.",
    "Resolving in CJS mode with conditions 'require', 'types'.",
    "Loading module as file / folder, candidate module location 'C:/w/src/f4', target file types: TypeScript, JavaScript, Declaration, JSON.",
    "File 'C:/w/src/f4.ts' exists - use it as a name resolution result.",
    "======== Module name './f4' was successfully resolved to 'C:/w/src/f4.ts'. ========",
    "======== Resolving module '@w/p00' from 'C:/w/src/f5.ts'. ========",
    "Loading module '@w/p00' from 'node_modules' folder, target file types: TypeScript, JavaScript, Declaration, JSON.",
    "Searching all ancestor node_modules directories for preferred extensions: TypeScript, Declaration.",
    "Directory 'C:/w/src/node_modules' does not exist, skipping all lookups in it.",
    "Found 'package.json' at 'C:/w/node_modules/@w/p00/package.json'.",
    "'package.json' does not have a 'typesVersions' field.",
    "'package.json' has 'main' field 'src/index.ts' that references 'C:/w/node_modules/@w/p00/src/index.ts'.",
    "File 'C:/w/node_modules/@w/p00/src/index.ts' does not exist according to earlier cached lookups.",
    "Resolving real path for 'C:/w/node_modules/@w/p00/src/index.ts', result 'C:/w/packages/p00/src/index.ts'.",
    "======== Module name '@w/p00' was successfully resolved to 'C:/w/packages/p00/src/index.ts' with Package ID '@w/p00/src/index.ts@1.0.0'. ========",
    "======== Module name 'missing' was not resolved. ========",
  ];
  const kept = [
    "src/f5.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.",
    "error TS6053: File 'C:/w/src/gone.ts' not found.",
    "C:/w/src/f5.ts",
    "TSFILE: C:/w/out/f5.js",
    "",
  ];
  const output = [
    trace[0],
    kept[0],
    ...trace.slice(1, 9),
    kept[1],
    ...trace.slice(9),
    kept[2],
    kept[3],
    kept[4],
  ].join("\r\n");
  assert.equal(
    CompilerTraceObservations.withoutTrace(output),
    kept.join("\r\n"),
  );
  assert.equal(
    CompilerTraceObservations.withoutTrace(kept.join("\n")),
    kept.join("\n"),
    "output without a trace is unchanged",
  );
}
