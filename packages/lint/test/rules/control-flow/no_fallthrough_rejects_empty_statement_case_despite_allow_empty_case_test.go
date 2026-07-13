package linthost

import "testing"

// TestNoFallthroughRejectsEmptyStatementCaseDespiteAllowEmptyCase verifies a lone `;` counts as a non-empty case.
//
// Upstream regression: `case 1: ; case 2:` reports even with allowEmptyCase
// enabled because the empty statement IS a statement — the option only covers
// cases with no consequent at all. Locks the consequent-length semantics of
// the empty-case exemption.
//
// 1. Give the case a single empty statement `;`.
// 2. Run the engine with options {"allowEmptyCase":true}.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsEmptyStatementCaseDespiteAllowEmptyCase(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0: ;
  case 1:
    console.log(1);
    break;
}
`, `{"allowEmptyCase":true}`, 4)
}
