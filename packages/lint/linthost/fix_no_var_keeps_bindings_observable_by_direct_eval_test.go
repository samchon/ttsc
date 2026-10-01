package linthost

import "testing"

// TestFixNoVarKeepsBindingsObservableByDirectEval verifies string-based reads are not lost in a lexical rewrite.
//
// A direct eval can read the function binding outside the proposed let block,
// including through a nested closure. Identifier-reference census cannot see it.
//
// 1. Check direct, parenthesized, nested and loop eval observations.
// 2. Require reported var declarations to stay byte-for-byte intact.
// 3. Retain safe ordinary and indirect-eval transformations.
//
// @evidence contracts/testing.md#behavioral-verification The disk fixer preserves direct-eval declarations and rewrites ordinary or indirect-eval declarations.
// @evidence contracts/testing.md#independent-expectations Direct eval reads its caller lexical environment; comma and optional calls are indirect and cannot observe a function-local x.
// @evidence contracts/testing.md#distinguishing-cases Function/block, nested closure, parenthesized callee and loop shapes contrast with indirect calls and an unrelated function's eval.
// @evidence contracts/testing.md#execution-ownership This unit exercises the actual rule and in-process disk edit applier without a host process.
func TestFixNoVarKeepsBindingsObservableByDirectEval(t *testing.T) {
  for _, source := range []string{
    "function f(){if(true){var x=42;}return eval('x');}",
    "function f(){if(true){var x=42;}return (eval)('x');}",
    "function f(){if(true){var x=42;}return eval!('x');}",
    "function f(){if(true){var x=42;}return (eval as typeof eval)('x');}",
    "function f(){if(true){var x=42;}return (eval satisfies typeof eval)('x');}",
    "function f(){if(true){var x=42;}return (<typeof eval>eval)('x');}",
    "function f(){if(true){var x=42;}return ()=>eval('x');}",
    "function f(){var x=eval('typeof x');}",
    "function f(){for(var x=0;x<1;x++){eval('x');}}",
    "var x=42; eval('x');",
  } {
    t.Run(source, func(t *testing.T) { assertNoFixSnapshot(t, "no-var", source) })
  }
  for _, pair := range [][2]string{
    {"function f(){var x=42;return x;}", "function f(){let x=42;return x;}"},
    {"function f(){var x=42;(0,eval)('x');}", "function f(){let x=42;(0,eval)('x');}"},
    {"function f(){var x=42;eval?.('x');}", "function f(){let x=42;eval?.('x');}"},
    {"function f(){var x=42;return x;} function g(){eval('y');}", "function f(){let x=42;return x;} function g(){eval('y');}"},
  } {
    t.Run(pair[0], func(t *testing.T) { assertFixSnapshot(t, "no-var", pair[0], pair[1]) })
  }
}
