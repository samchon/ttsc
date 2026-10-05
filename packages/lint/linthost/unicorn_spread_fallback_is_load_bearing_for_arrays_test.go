package linthost

import "testing"

// TestUnicornSpreadFallbackIsLoadBearingForArrays verifies spread fallback depends on iterable versus property-copy semantics.
//
// Array and call spread throw on nullish input without the iterable fallback; object spread copies no nullish properties.
//
// 1. Run the rule on authored load-bearing or value-consuming expressions.
// 2. Require those expressions to receive no diagnostic.
// 3. Retain report-only findings on the ordinary supported idiom.
//
// @evidence contracts/testing.md#behavioral-verification The owning Engine runs unicorn/no-useless-fallback-in-spread; zero findings distinguish load-bearing inputs and report-only positives preserve rule activation.
// @evidence contracts/testing.md#independent-expectations Array and call spread throw on nullish input without the iterable fallback; object spread copies no nullish properties.
// @evidence contracts/testing.md#distinguishing-cases Array nullish/logical and call-argument fallbacks remain, while object-spread fallbacks still report without edits.
// @evidence contracts/testing.md#execution-ownership This source unit runs the actual AST rule and findings helpers in process without a native producer.
func TestUnicornSpreadFallbackIsLoadBearingForArrays(t *testing.T) {
  for _, source := range []string{
    "const xs = [...(nullable ?? [])];",
    "const xs = [...(nullable || [])];",
    "f(...(nullable ?? []));",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/no-useless-fallback-in-spread", source) })
  }
  for _, source := range []string{
    "const o = {...(nullable ?? {})};",
    "const o = {...(nullable || [])};",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/no-useless-fallback-in-spread", source) })
  }
}
