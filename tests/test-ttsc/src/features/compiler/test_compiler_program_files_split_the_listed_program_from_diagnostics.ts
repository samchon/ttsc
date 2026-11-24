import assert from "node:assert/strict";
import path from "node:path";

import { CompilerProgramFiles } from "../../../../../packages/ttsc/src/compiler/internal/build/CompilerProgramFiles";
import { appendBuildOutput } from "../../../../../packages/ttsc/src/compiler/internal/build/appendBuildOutput";

/**
 * Verifies a watch cycle reads its Program's membership from the compiler's own
 * `--listFiles` answer without losing any diagnostic text (#1865).
 *
 * The watch topology takes this list instead of starting a second compiler
 * run, so every listed path must be kept and every other line must stay in
 * the displayed output.
 *
 * 1. Split output that mixes plain and pretty diagnostics, a summary line and
 *    listed files in both slash spellings.
 * 2. Require the files resolved natively and the rest unchanged, in order.
 * 3. Require an output without listed files to yield none, and a merged build
 *    result to keep the later phase's list.
 *
 * @evidence contracts/testing.md#behavioral-verification CompilerProgramFiles.split runs on literal compiler output; the assertions catch a split that drops a listed file, takes a diagnostic line as a member, or loses or reorders displayed text, and appendBuildOutput must keep a reported list.
 * @evidence contracts/testing.md#independent-expectations Expected members are the absolute lines written into the input, resolved by path.resolve; expected remaining text is the input without exactly those lines.
 * @evidence contracts/testing.md#distinguishing-cases Owns diagnostic, continuation, summary and listed lines together, an output with no list, and phase merging; the E2E watch cases own the compiler's real output.
 * @evidence contracts/testing.md#execution-ownership A unit test calling the pure split and merge in process; no compiler runs.
 */
export function test_compiler_program_files_split_the_listed_program_from_diagnostics(): void {
  const first = path.resolve("project", "src", "main.ts");
  const second = path.resolve("project", "src", "other.ts");
  const diagnostics = [
    "src/main.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.\n",
    "src/main.ts:1:14 - error TS2322: Type 'string' is not assignable to type 'number'.\n",
    "  1 export const value: number = 'text';\n",
    "\n",
    "Found 2 errors in the same file, starting at: src/main.ts:1\n",
  ];
  const output = [
    diagnostics[0]!,
    `${first}\n`,
    diagnostics[1]!,
    diagnostics[2]!,
    `${second.split(path.sep).join("/")}\r\n`,
    diagnostics[3]!,
    diagnostics[4]!,
  ].join("");
  const split = CompilerProgramFiles.split(output);
  assert.deepEqual(split.files, [first, second]);
  assert.equal(split.rest, diagnostics.join(""));

  const none = CompilerProgramFiles.split(diagnostics.join(""));
  assert.deepEqual(none.files, []);
  assert.equal(none.rest, diagnostics.join(""));

  const empty = { diagnostics: [], status: 0, stderr: "", stdout: "" };
  assert.deepEqual(
    appendBuildOutput({ ...empty, programFiles: [first] }, empty).programFiles,
    [first],
  );
  assert.deepEqual(
    appendBuildOutput(
      { ...empty, programFiles: [first] },
      { ...empty, programFiles: [second] },
    ).programFiles,
    [second],
  );
  assert.equal(appendBuildOutput(empty, empty).programFiles, undefined);
}
