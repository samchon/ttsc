package linthost

import "testing"

// TestDefaultCaseRejectsUnrelatedTrailingComment verifies a non-marker trailing comment does not suppress the finding.
//
// Only a comment matching the pattern is a marker; an ordinary `// TODO` after
// the last clause still leaves the default omitted. Negative twin of the
// marker acceptance, one property away (the comment text changed).
//
// 1. Place `// TODO: handle the rest` as the trailing comment.
// 2. Run the engine with default-case enabled.
// 3. Assert exactly one finding at the switch statement (line 2).
//
// @evidence contracts/testing.md#behavioral-verification Engine requires exactly one error at switch line two for an unrelated trailing TODO comment.
// @evidence contracts/testing.md#independent-expectations The authored TODO text does not independently match the default marker; ordinary comments do not exempt omitted defaults.
// @evidence contracts/testing.md#distinguishing-cases Unrelated last comment reports; the matching-marker cases own clean comment counterparts.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseRejectsUnrelatedTrailingComment is selected in the shared Go unit population. It calls assertDefaultCaseReportsAtLines and lintDefaultCase with the authored unrelated TODO comment and empty options, using RuleConfig directly as the resolver for Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseRejectsUnrelatedTrailingComment(t *testing.T) {
  assertDefaultCaseReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // TODO: handle the rest
}
`, "", 2)
}
