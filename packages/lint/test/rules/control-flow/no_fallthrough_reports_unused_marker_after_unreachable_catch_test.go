package linthost

import "testing"

// TestNoFallthroughReportsUnusedMarkerAfterUnreachableCatch verifies a catch
// with no reachable throw edge cannot make a fallthrough marker useful. The
// unused-marker option must report the comment after a bare return.
//
// 1. Return without evaluating an expression inside try and add an empty catch.
// 2. Put a standard marker before the next case label.
// 3. Assert the unused-marker diagnostic points at that comment.
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
  if len(actual) != 1 || actual[0].Line != 7 {
    t.Fatalf("expected one unused-marker finding at line 7, got %+v", actual)
  }
  if findings[0].Message != "Found a comment that would permit fallthrough, but case cannot fall through." {
    t.Fatalf("unexpected message: %q", findings[0].Message)
  }
}
