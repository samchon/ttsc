package linthost

import (
  "strings"
  "testing"
)

// TestMaxNestedCallbacksCountsOnlyFunctionsPassedToCalls verifies that
// max-nested-callbacks counts a function only when it is an operand of a call.
//
// ESLint 9.39.2 pushes its callback stack for a function whose parent is a call
// expression, so eleven nested functions that are assigned or returned are not
// callback hell, while eleven nested call arguments are.
//
//  1. Build a source in which eleven arrow functions nest through call arguments
//     and assert the rule reports exactly once; this case does not pin its range.
//  2. Build one in which eleven arrow functions nest through object properties and
//     assert nothing is reported.
//  3. Build one with ten call arguments plus one parenthesized immediately invoked
//     function and assert it reports once, then drop the invocation so the function
//     is only parenthesized and assert nothing is reported.
//
// @evidence contracts/testing.md#behavioral-verification max-nested-callbacks reports once for eleven call-argument functions and for ten arguments plus a parenthesized IIFE, while ignoring property-stored functions and the adjacent returned non-invoked function.
// @evidence contracts/testing.md#independent-expectations ESLint 9.39.2 uses the call-parent predicate and default threshold ten; independently generated eleven-deep inputs and adjacent non-call controls pin this rule policy, without certifying later ESLint revisions.
// @evidence contracts/testing.md#distinguishing-cases The call-nested and property-nested sources have the same depth and differ only in whether each function is a call operand, so a rule counting every function fails the second source.
// @evidence contracts/testing.md#execution-ownership TestMaxNestedCallbacksCountsOnlyFunctionsPassedToCalls uses the shared snapshot helper to materialize and parse authored sources, validate semantic findings and call the actual AST engine in the shared Go unit process; no consumer install or native build runs.
func TestMaxNestedCallbacksCountsOnlyFunctionsPassedToCalls(t *testing.T) {
  nest := func(open, close string, depth int) string {
    return "declare function run(fn: () => unknown): unknown;\n" +
      "JSON.stringify(" + strings.Repeat(open, depth) + "0" + strings.Repeat(close, depth) + ");\n"
  }
  _, _, findings := runRuleFindingsSnapshot(t, "max-nested-callbacks", nest("run(() => ", ")", 11), nil)
  if len(findings) != 1 {
    t.Fatalf("eleven nested call arguments: want one finding, got %d", len(findings))
  }
  assertRuleSkipsSource(t, "max-nested-callbacks", nest("{ f: () => (", ") }", 11))
  mixed := "declare function run(fn: () => unknown): unknown;\n" +
    "JSON.stringify(" + strings.Repeat("run(() => ", 10) + "((function () { return 0; })())" + strings.Repeat(")", 10) + ");\n"
  _, _, findings = runRuleFindingsSnapshot(t, "max-nested-callbacks", mixed, nil)
  if len(findings) != 1 {
    t.Fatalf("ten arguments plus a parenthesized IIFE: want one finding, got %d", len(findings))
  }
  returned := "declare function run(fn: () => unknown): unknown;\n" +
    "JSON.stringify(" + strings.Repeat("run(() => ", 10) + "((function () { return 0; }))" + strings.Repeat(")", 10) + ");\n"
  assertRuleSkipsSource(t, "max-nested-callbacks", returned)
}
