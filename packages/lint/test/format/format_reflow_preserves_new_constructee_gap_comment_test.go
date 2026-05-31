package linthost

import "testing"

// TestFormatReflowPreservesNewConstructeeGapComment pins the data-safety guard
// for a comment in the `new`->constructee gap of a NO-ARGUMENT new expression
// (`new /* c */ Foo`). The new-expression sits inside an array that overflows
// and would reflow; the `new` keyword and constructee are not separated by an
// AST child, so the comment is masked from the outer scan. The no-args path of
// printNewExpression mints `new ` and trivia-trims the constructee, so without
// the hoisted guard the comment is dropped. With it the new-expression reports
// uncovered, the enclosing reflow abstains, and the bytes survive.
func TestFormatReflowPreservesNewConstructeeGapComment(t *testing.T) {
  assertFormatUnchanged(t, `const result = wrapWithAnEvenLongerFunctionNameToForceReflow([new /* keep */ AllocatorInstance]);
`)
}
