package linthost

import "testing"

// TestNoFallthroughReportsCaseMessageAfterLeadingDefault verifies a leading default clause can fall through into a case.
//
// Clause order is positional, not semantic: a `default:` that is not last
// participates in transitions like any case, and the reported clause (a
// case) picks the 'case' message. Locks both nonterminal default handling and
// message selection from the target clause.
//
// 1. Open the switch with a populated default clause followed by a case.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert one finding at the case with the 'case' message.
//
// @evidence contracts/testing.md#behavioral-verification One no-fallthrough error at original line five carries exactly the case-target message.
// @evidence contracts/testing.md#independent-expectations The authored leading default can fall into a later case; the reported target kind independently selects case rather than predecessor default wording.
// @evidence contracts/testing.md#distinguishing-cases ReportsDefaultMessageForDefaultClause reverses the target kind and verifies default wording.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughReportsCaseMessageAfterLeadingDefault is selected in the shared Go unit population and invokes lintNoFallthrough through the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughReportsCaseMessageAfterLeadingDefault(t *testing.T) {
  file, findings := lintNoFallthrough(t, `declare const foo: number;
switch (foo) {
  default:
    console.log(0);
  case 1:
    console.log(1);
    break;
}
`, "")
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != 1 || actual[0].Rule != "no-fallthrough" || actual[0].Severity != SeverityError || actual[0].Line != 5 {
    t.Fatalf("expected one finding at line 5, got %+v", actual)
  }
  if findings[0].Message != "Expected a 'break' statement before 'case'." {
    t.Fatalf("unexpected message: %q", findings[0].Message)
  }
}
