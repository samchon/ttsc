package linthost

import "testing"

// TestNoFallthroughRejectsEmptyCaseFollowedByBlankLine verifies the default blank-line heuristic for empty cases.
//
// Upstream invalid case `case 0:\n\ncase 1:`: an empty case separated from
// the next label by a blank line reads like a forgotten body, so ESLint
// reports it unless allowEmptyCase is set. Negative twin of the
// adjacent-labels acceptance, one property away (a blank line inserted).
//
// 1. Separate an empty case from the next label with one blank line.
// 2. Run the engine with no-fallthrough enabled and default options.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsEmptyCaseFollowedByBlankLine(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:

  case 1:
    console.log(1);
    break;
}
`, "", 5)
}
