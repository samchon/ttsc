package linthost

import "testing"

// TestUnicornArraySomeRequiresAnExistenceComparison verifies array existence advice excludes the always-true nonnegative length check.
//
// An empty filtered array has length zero, so >= 0 is true while some is false.
//
// 1. Run the rule on authored load-bearing or value-consuming expressions.
// 2. Require those expressions to receive no diagnostic.
// 3. Retain report-only findings on the ordinary supported idiom.
//
// @evidence contracts/testing.md#behavioral-verification The owning Engine runs unicorn/prefer-array-some; zero findings distinguish load-bearing inputs and report-only positives preserve rule activation.
// @evidence contracts/testing.md#independent-expectations An empty filtered array has length zero, so >= 0 is true while some is false.
// @evidence contracts/testing.md#distinguishing-cases The >= 0 negative is paired with > 0 and !== 0 existence comparisons, preserving report-only activation.
// @evidence contracts/testing.md#execution-ownership This source unit runs the actual AST rule and findings helpers in process without a native producer.
func TestUnicornArraySomeRequiresAnExistenceComparison(t *testing.T) {
  for _, source := range []string{
    "const exists = xs.filter(p).length >= 0;",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/prefer-array-some", source) })
  }
  for _, source := range []string{
    "const exists = xs.filter(p).length > 0;",
    "const exists = xs.filter(p).length !== 0;",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/prefer-array-some", source) })
  }
}
