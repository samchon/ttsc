package linthost

import "testing"

// TestUnicornSingleCallExcludesEventListenerRegistration verifies listener registration is excluded from variadic-call advice.
//
// EventTarget accepts one listener per call; combining listeners as extra arguments loses one registration or removal.
//
// 1. Run the rule on authored load-bearing or value-consuming expressions.
// 2. Require those expressions to receive no diagnostic.
// 3. Retain report-only findings on the ordinary supported idiom.
//
// @evidence contracts/testing.md#behavioral-verification The owning Engine runs unicorn/prefer-single-call; zero findings distinguish load-bearing inputs and report-only positives preserve rule activation.
// @evidence contracts/testing.md#independent-expectations EventTarget accepts one listener per call; combining listeners as extra arguments loses one registration or removal.
// @evidence contracts/testing.md#distinguishing-cases Both addEventListener and removeEventListener remain distinct, while consecutive push and unshift calls report.
// @evidence contracts/testing.md#execution-ownership This source unit runs the actual AST rule and findings helpers in process without a native producer.
func TestUnicornSingleCallExcludesEventListenerRegistration(t *testing.T) {
  for _, source := range []string{
    "target.addEventListener('event', a); target.addEventListener('event', b);",
    "target.removeEventListener('event', a); target.removeEventListener('event', b);",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/prefer-single-call", source) })
  }
  for _, source := range []string{
    "xs.push(a); xs.push(b);",
    "xs.unshift(a); xs.unshift(b);",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/prefer-single-call", source) })
  }
}

