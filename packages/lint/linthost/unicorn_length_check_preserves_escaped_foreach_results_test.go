package linthost

import "testing"

// TestUnicornLengthCheckPreservesEscapedForEachResults verifies forEach guard advice preserves escaped result values.
//
// For empty input the length guard yields false while forEach yields undefined; some already yields false and every yields true.
//
// 1. Run the rule on authored load-bearing or value-consuming expressions.
// 2. Require those expressions to receive no diagnostic.
// 3. Retain report-only findings on the ordinary supported idiom.
//
// @evidence contracts/testing.md#behavioral-verification The owning Engine runs unicorn/no-useless-length-check; zero findings distinguish load-bearing inputs and report-only positives preserve rule activation.
// @evidence contracts/testing.md#independent-expectations For empty input the length guard yields false while forEach yields undefined; some already yields false and every yields true.
// @evidence contracts/testing.md#distinguishing-cases Assignments, returns and nullish fallback retain forEach guards; discarded or boolean results and ordinary some still report.
// @evidence contracts/testing.md#execution-ownership This source unit runs the actual AST rule and findings helpers in process without a native producer.
func TestUnicornLengthCheckPreservesEscapedForEachResults(t *testing.T) {
  for _, source := range []string{
    "const result = xs.length > 0 && xs.forEach(f);",
    "function result(){return xs.length > 0 && xs.forEach(f);}",
    "const result = (xs.length > 0 && xs.forEach(f)) ?? fallback;",
    "xs.length > 0 && xs.every(f);",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/no-useless-length-check", source) })
  }
  for _, source := range []string{
    "xs.length > 0 && xs.forEach(f);",
    "if (xs.length > 0 && xs.forEach(f)) {}",
    "const result = xs.length > 0 && xs.some(f);",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/no-useless-length-check", source) })
  }
}

