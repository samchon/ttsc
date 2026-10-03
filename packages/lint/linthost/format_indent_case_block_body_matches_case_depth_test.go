package linthost

import "testing"

// TestFormatIndentCaseBlockBodyMatchesCaseDepth verifies a statement
// inside an explicit `case X: { ... }` block is indented to the case
// body's depth, not one level deeper.
//
// The supported layout gives a block opened on the case-label line no
// additional body level. This literal positive distinguishes counting
// both the case clause and that same-line block as separate levels.
//
//  1. Parse a switch whose case body is a block with an over-indented
//     statement.
//  2. Apply format/indent (tabWidth 2).
//  3. Assert the statement lands at the case-body depth (4), not 6.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must move the over-indented doThing statement to four spaces inside a block opened on the case-label line. Complete source distinguishes counting that same-line block as an extra indentation level and retains all switch/call tokens.
// @evidence contracts/testing.md#independent-expectations The supported same-line case-block layout puts its statements at the ordinary case-body column. This dedicated rule oracle retains the original missing call semicolon because terminator spelling belongs to a different rule.
// @evidence contracts/testing.md#distinguishing-cases This positive opens the explicit block on the case label line and starts its statement eight spaces deep. NormalizesSwitchCaseBodyDepth covers an unbraced case body; this host does not claim all separately opened nested blocks have the same depth.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentCaseBlockBodyMatchesCaseDepth owns its literal input/options/output in the public Go unit population. The syntax-only harness calls the owning rule and applies edits in process without installing a consumer, building native artifacts or starting a real product host.
func TestFormatIndentCaseBlockBodyMatchesCaseDepth(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/indent",
    "switch (s) {\n  case A: {\n        doThing()\n  }\n}\n",
    `{"tabWidth":2}`,
    "switch (s) {\n  case A: {\n    doThing()\n  }\n}\n",
  )
}
