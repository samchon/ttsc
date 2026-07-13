package linthost

import "testing"

// TestFixPreferAsConstSkipsVariableAnnotationRewrite verifies preferAsConst reports variable annotations without edits.
//
// Upstream pairs the variable-annotation report with a suggestion, never an
// autofix: `eslint --fix` leaves `let x: 'a' = 'a'` untouched because the
// rewrite moves the type out of the annotation. `ttsc fix` applies every
// emitted TextEdit unconditionally, so the finding must carry none or the
// fix command would apply what upstream reserves for a manual action.
//
// 1. Parse a source file with `let value: "literal" = "literal";`.
// 2. Run preferAsConst and apply any offered text edits.
// 3. Assert a finding exists and the source remains unchanged.
func TestFixPreferAsConstSkipsVariableAnnotationRewrite(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "typescript/prefer-as-const",
    "let value: \"literal\" = \"literal\";\nJSON.stringify(value);\n",
  )
}
