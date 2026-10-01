package linthost

import "testing"

// TestUnicornAwaitLiteralDoesNotAssumeAnObjectHasNoThen verifies await advice excludes object shapes that can supply then.
//
// Await assignment resolves an own then method to its delivered value; spreading, computed names and prototype setters can also supply then.
//
// 1. Run the rule on authored load-bearing or value-consuming expressions.
// 2. Require those expressions to receive no diagnostic.
// 3. Retain report-only findings on the ordinary supported idiom.
//
// @evidence contracts/testing.md#behavioral-verification The owning Engine runs unicorn/no-unnecessary-await; zero findings distinguish load-bearing inputs and report-only positives preserve rule activation.
// @evidence contracts/testing.md#independent-expectations Await assignment resolves an own then method to its delivered value; spreading, computed names and prototype setters can also supply then.
// @evidence contracts/testing.md#distinguishing-cases Then-capable object shapes remain, while number, array and plain-object literals report without edits; async return assimilation is not the value oracle.
// @evidence contracts/testing.md#execution-ownership This source unit runs the actual AST rule and findings helpers in process without a native producer.
func TestUnicornAwaitLiteralDoesNotAssumeAnObjectHasNoThen(t *testing.T) {
  for _, source := range []string{
    "async function f(){const value = await {then(resolve){resolve(42)}}; return value;}",
    "async function f(){const value = await {...other}; return value;}",
    "async function f(){const value = await {[key]: value}; return value;}",
    "async function f(){const value = await {__proto__: other}; return value;}",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/no-unnecessary-await", source) })
  }
  for _, source := range []string{
    "async function f(){const value = await 42; return value;}",
    "async function f(){const value = await []; return value;}",
    "async function f(){const value = await {}; return value;}",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/no-unnecessary-await", source) })
  }
}

