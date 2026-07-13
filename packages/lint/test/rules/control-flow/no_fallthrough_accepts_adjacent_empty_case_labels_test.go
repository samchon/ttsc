package linthost

import "testing"

// TestNoFallthroughAcceptsAdjacentEmptyCaseLabels verifies stacked empty case labels never report.
//
// `case 0: case 1:` is the idiomatic way to share one body between several
// values; ESLint always allows it (no option needed) because the empty case
// has no statements and no blank-line gap. Locks the empty-case exemption.
//
// 1. Stack two labels directly above a shared body.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsAdjacentEmptyCaseLabels(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
  case 1:
    console.log(1);
    break;
}
`, "")
}
