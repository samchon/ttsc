package linthost

import "testing"

// TestCommandFormatTerminatesASplitInterfaceMember verifies the cascade
// reaches Prettier's shape for a one-line interface body.
//
// samchon/ttsc#1166: format/indent broke the body out and format/semi then
// declined every type member, so the run ended on `alpha: number` with no
// terminator, a shape Prettier never emits. Only the LAST member showed it
// in a multi-member body, because the interior `;` was already written as a
// separator, which made the output internally inconsistent rather than
// uniformly bare. This is the cascade case, not the rule case: the insert
// waits for the break, so it lands one pass after the split.
//
//  1. Seed one-member and two-member interfaces written on one line.
//  2. Run `ttsc format`.
//  3. Assert the file equals Prettier 3.8.3's output, every member
//     terminated.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on two one-line interfaces (one member, and two members with the last unterminated) and requires the exact output with each body split over lines and every member, including the last, ending in `;`.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored literal that the test comment attributes to Prettier 3.8.3 (not re-verified here); the unterminated last member after the split is the defect it rejects.
// @evidence contracts/testing.md#distinguishing-cases A one-member and a two-member body separate a last member with no separator from one whose interior terminator already exists; both must end uniformly terminated.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatResult; no child process, built binary or installed consumer.
func TestCommandFormatTerminatesASplitInterfaceMember(t *testing.T) {
  assertFormatResult(
    t,
    "export interface Alpha { alpha: number }\n"+
      "export interface Bravo { alpha: number; bravo: string }\n",
    "export interface Alpha {\n"+
      "  alpha: number;\n"+
      "}\n"+
      "export interface Bravo {\n"+
      "  alpha: number;\n"+
      "  bravo: string;\n"+
      "}\n",
  )
}
