package linthost

import "testing"

// TestNoFallthroughReportsCaseMessageAfterLeadingDefault verifies a default clause in the middle can fall through into a case.
//
// Clause order is positional, not semantic: a `default:` that is not last
// participates in transitions like any case, and the reported clause (a
// case) picks the 'case' message. Locks both mid-switch default handling and
// message selection from the target clause.
//
// 1. Open the switch with a populated default clause followed by a case.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert one finding at the case with the 'case' message.
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
  if len(actual) != 1 || actual[0].Line != 5 {
    t.Fatalf("expected one finding at line 5, got %+v", actual)
  }
  if findings[0].Message != "Expected a 'break' statement before 'case'." {
    t.Fatalf("unexpected message: %q", findings[0].Message)
  }
}
