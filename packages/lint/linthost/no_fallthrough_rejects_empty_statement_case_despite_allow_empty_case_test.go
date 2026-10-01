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
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line four for a semicolon statement.
// @evidence contracts/testing.md#independent-expectations A semicolon contributes an actual consequent statement, so the no-consequent allowEmptyCase option does not apply.
// @evidence contracts/testing.md#distinguishing-cases AllowEmptyCasePermitsBlankLineGap owns a genuinely statement-free accepted case.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsEmptyStatementCaseDespiteAllowEmptyCase is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
