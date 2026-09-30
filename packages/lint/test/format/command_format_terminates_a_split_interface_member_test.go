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
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises terminates a split interface member and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert the file equals Prettier 3.8.3's output, every member terminated.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed one-member and two-member interfaces written on one line. The asserted decision is: Assert the file equals Prettier 3.8.3's output, every member terminated. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatTerminatesASplitInterfaceMember owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
