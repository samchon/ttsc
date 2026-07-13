package linthost

import "testing"

// TestNoFallthroughReportsUnusedFallthroughComment verifies reportUnusedFallthroughComment flags a marker after a break.
//
// Upstream invalid case: the case ends in `break`, so the `/* falls through */`
// above the next label documents behavior the code does not have. With the
// option on, the rule reports at the comment itself with ESLint's dedicated
// message. Locks the unused-comment branch, its position, and its message.
//
// 1. Put a marker between a breaking case and the next label.
// 2. Run the engine with options {"reportUnusedFallthroughComment":true}.
// 3. Assert one finding at the comment's line with the unused-comment message.
func TestNoFallthroughReportsUnusedFallthroughComment(t *testing.T) {
  file, findings := lintNoFallthrough(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  /* falls through */
  case 1:
    console.log(1);
}
`, `{"reportUnusedFallthroughComment":true}`)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != 1 || actual[0].Line != 6 {
    t.Fatalf("expected one finding at line 6, got %+v", actual)
  }
  if findings[0].Message != "Found a comment that would permit fallthrough, but case cannot fall through." {
    t.Fatalf("unexpected message: %q", findings[0].Message)
  }
}
