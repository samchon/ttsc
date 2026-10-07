package linthost

import "testing"

// TestNoFallthroughReportsDefaultMessageForDefaultClause verifies falling into `default:` names 'default' in the message.
//
// ESLint has two messages — "Expected a 'break' statement before 'case'." and
// "... before 'default'." — chosen by the REPORTED clause's kind. Locks the
// message selection so a default target is not mislabeled as a case.
//
// 1. Let a populated case fall into the default clause.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert one finding whose message names 'default'.
//
// @evidence contracts/testing.md#behavioral-verification One no-fallthrough error at the original default target carries exactly the default-target message.
// @evidence contracts/testing.md#independent-expectations The authored next clause is default, independently requiring default wording regardless of the preceding numeric case.
// @evidence contracts/testing.md#distinguishing-cases ReportsCaseMessageAfterLeadingDefault retains the case-target counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughReportsDefaultMessageForDefaultClause is selected in the shared Go unit population and invokes lintNoFallthrough through the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughReportsDefaultMessageForDefaultClause(t *testing.T) {
  file, findings := lintNoFallthrough(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
  default:
    console.log(2);
}
`, "")
  actual := normalizeRuleFindings(file, findings)
  if len(findings) != 1 || actual[0].Rule != "no-fallthrough" || actual[0].Severity != SeverityError || actual[0].Line != 5 {
    t.Fatalf("expected one finding, got %+v", findings)
  }
  if findings[0].Message != "Expected a 'break' statement before 'default'." {
    t.Fatalf("unexpected message: %q", findings[0].Message)
  }
}
