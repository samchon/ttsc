import assert from "node:assert/strict";

import { ConsumerBatch } from "../internal/ConsumerBatch";

/**
 * Verifies the actual batch splitter preserves separate project and source
 * findings.
 *
 * Unanchored package and project findings must remain visible alongside source
 * findings, including the explanatory lines that belong to each banner.
 *
 * 1. Supply literal project errors and plain or pretty source banners.
 * 2. Split and normalize those direct operation inputs.
 * 3. Assert all four independent chunks and their continuation text.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the maintained diagnostic splitter with literal plain-project, source-position and pretty source banners; each banner remains its own chunk, including multiline explanatory text.
 * @evidence contracts/testing.md#independent-expectations The input and expected chunks are independently authored literal renderer shapes. The result-shaped object is direct splitter input; it is never claimed as a real compiler outcome or passed to an E2E assertion.
 * @evidence contracts/testing.md#distinguishing-cases Consecutive unanchored project errors distinguish the previous source-only splitter; pretty warnings and Windows path normalization exercise separate supported banners, while continuation lines remain attached.
 * @evidence contracts/testing.md#execution-ownership The matching named source-unit function is selected by test-evidence's source-unit runner and executes the splitter directly without a compiler, workspace or native producer.
 */
export function test_evidence_consumer_diagnostics_preserve_project_banners(): void {
  const input =
    "error TS1001: first project finding\n  detail\nerror TS1002: second project finding\nsrc/a.ts(3,4): error TS1003: source finding\nC:\\fixture\\src\\b.ts:5:6 - warning TS1004: warning finding\n";
  const actual = ConsumerBatch.diagnostics({
    status: 2,
    stdout: input,
    stderr: "",
    output: input,
  });
  assert.deepEqual(actual.filter(Boolean), [
    "error TS1001: first project finding\n  detail\n",
    "error TS1002: second project finding\n",
    "src/a.ts(3,4): error TS1003: source finding\n",
    "C:/fixture/src/b.ts:5:6 - warning TS1004: warning finding\n",
  ]);
}
