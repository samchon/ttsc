package linthost

import "testing"

// TestFixPreferAsConstSkipsVariableAnnotationRewrite verifies preferAsConst reports variable annotations without edits.
//
// Upstream pairs the variable-annotation report with a suggestion, never an
// autofix: `eslint --fix` leaves `let x: 'a' = 'a'` untouched because the
// rewrite moves the type out of the annotation. The finding carries that
// rewrite only in Suggestions, leaving Fix empty so `ttsc fix` cannot apply
// what upstream reserves for a manual action.
//
// 1. Parse a source file with `let value: "literal" = "literal";`.
// 2. Run preferAsConst and apply any offered text edits.
// 3. Assert a finding exists and the source remains unchanged.
//
// @evidence contracts/testing.md#behavioral-verification prefer-as-const reports the variable literal annotation while preserving its original bytes under autofix.
// @evidence contracts/testing.md#independent-expectations The authored let annotation and zero applied edits follow the manual-action contract; the exact suggested result belongs to the companion suggestion test.
// @evidence contracts/testing.md#distinguishing-cases Variable annotations stay suggestion-only; ordinary as assertions fix automatically.
// @evidence contracts/testing.md#execution-ownership TestFixPreferAsConstSkipsVariableAnnotationRewrite runs assertNoFixSnapshot on the literal variable annotation.
func TestFixPreferAsConstSkipsVariableAnnotationRewrite(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "typescript/prefer-as-const",
    "let value: \"literal\" = \"literal\";\nJSON.stringify(value);\n",
  )
}
