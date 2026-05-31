package linthost

import "testing"

// TestFormatReflowPreservesTernaryParenComment pins the data-safety guard for a
// comment inside the parentheses of a consequent-nested ternary arm. The arm is
// unwrapped (`(b ? c : d)` -> `b ? c : d`) to chain the staircase; if a comment
// sits between the parens and the inner conditional, the unwrap would delete it.
// The guard declines the unwrap when a comment is present, routing the ParenExpr
// through the self-guarding printer so the bytes survive verbatim.
func TestFormatReflowPreservesTernaryParenComment(t *testing.T) {
  assertFormatUnchanged(t, `const value = someOuterConditionValueHere
  ? (/* keep */ innerCondition ? innerTrueResultValue : innerFalseResultValue)
  : outerFalsyFallbackResultValue;
`)
}
