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
func TestNoFallthroughReportsDefaultMessageForDefaultClause(t *testing.T) {
  _, findings := lintNoFallthrough(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
  default:
    console.log(2);
}
`, "")
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %+v", findings)
  }
  if findings[0].Message != "Expected a 'break' statement before 'default'." {
    t.Fatalf("unexpected message: %q", findings[0].Message)
  }
}
