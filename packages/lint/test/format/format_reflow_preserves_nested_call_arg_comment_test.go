package linthost

import "testing"

// TestFormatReflowPreservesNestedCallArgComment pins the data-safety guard for
// nested calls. The outer call overflows printWidth and would reflow, but its
// single argument is an inner call carrying a comment in its OWN argument gap.
// The top-level print-width scan masks the inner call (a direct child), so the
// comment is invisible there; without the call-printer self-guard the recursive
// reprint of the inner call drops `/* keep */`. With the guard the inner call
// reports uncovered, the outer reflow abstains, and the bytes survive verbatim.
func TestFormatReflowPreservesNestedCallArgComment(t *testing.T) {
  assertFormatUnchanged(t, `const result = outerFunctionWithAQuiteLongName(innerCallHelper(alphaArgument, /* keep */ betaArgument));
`)
}
