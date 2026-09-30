package linthost

import "testing"

// TestNoFallthroughReportsUnusedMarkerAfterUnreachableCatch verifies a catch
// with no reachable throw edge cannot make a fallthrough marker useful. The
// unused-marker option must report the comment after a bare return.
//
// 1. Return without evaluating an expression inside try and add an empty catch.
// 2. Put a standard marker before the next case label.
// 3. Assert the unused-marker diagnostic points at that comment.
//
// @evidence contracts/testing.md#behavioral-verification One no-fallthrough error at original comment line seven carries the exact unused-marker message.
// @evidence contracts/testing.md#independent-expectations A bare return has no supported first-throwable operand, so an unreachable empty catch cannot make the trailing marker useful.
// @evidence contracts/testing.md#distinguishing-cases CommandPreservesMarkersAcrossCatchReachability retains option-disabled and explicitly throwing catch boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughReportsUnusedMarkerAfterUnreachableCatch is selected in the shared Go unit population and invokes lintNoFallthrough through the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughReportsUnusedMarkerAfterUnreachableCatch(t *testing.T) {
  file, findings := lintNoFallthrough(t, `function inspect(value: number): void {
  switch (value) {
    case 0:
      try {
        return;
      } catch {}
      // falls through
    case 1:
      break;
  }
}
`, `{"reportUnusedFallthroughComment":true}`)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != 1 || actual[0].Rule != "no-fallthrough" || actual[0].Severity != SeverityError || actual[0].Line != 7 {
    t.Fatalf("expected one unused-marker finding at line 7, got %+v", actual)
  }
  if findings[0].Message != "Found a comment that would permit fallthrough, but case cannot fall through." {
    t.Fatalf("unexpected message: %q", findings[0].Message)
  }
}
