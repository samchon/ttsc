package linthost

import "testing"

// TestUnicornRegexpTestRequiresABooleanResultConsumer verifies regexp advice requires an actual truthiness consumer.
//
// Match arrays retain captures and nullish fallback distinguishes null from false; only a truthiness consumer can discard the match value.
//
// 1. Run the rule on authored load-bearing or value-consuming expressions.
// 2. Require those expressions to receive no diagnostic.
// 3. Retain report-only findings on the ordinary supported idiom.
//
// @evidence contracts/testing.md#behavioral-verification The owning Engine runs unicorn/prefer-regexp-test; zero findings distinguish load-bearing inputs and report-only positives preserve rule activation.
// @evidence contracts/testing.md#independent-expectations Match arrays retain captures and nullish fallback distinguishes null from false; only a truthiness consumer can discard the match value.
// @evidence contracts/testing.md#distinguishing-cases Assigned, returned, passed and nullish match values remain; if, negation and boolean logical chains still report.
// @evidence contracts/testing.md#execution-ownership This source unit runs the actual AST rule and findings helpers in process without a native producer.
func TestUnicornRegexpTestRequiresABooleanResultConsumer(t *testing.T) {
  for _, source := range []string{
    "const captures = text.match(/(a)/) || [];",
    "function result(){return text.match(/(a)/) && value;}",
    "if (text.match(/a/) ?? true) {}",
    "consume(text.match(/a/) || []);",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/prefer-regexp-test", source) })
  }
  for _, source := range []string{
    "if (text.match(/a/)) {}",
    "if ((text.match(/a/) || other)) {}",
    "const present = !text.match(/a/);",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/prefer-regexp-test", source) })
  }
}
