package linthost

import "testing"

// TestEqeqeqOffersUnsafeOperatorRewriteAsSuggestion verifies a coercion-
// sensitive `==` still exposes the `===` rewrite as an opt-in suggestion.
//
// `isEqeqeqAutoFixSafe` refuses to impose the tightening because two operands
// of unproven type can compare equal loosely and unequal strictly, so an
// automatic rewrite would change what the program computes. That judgement
// belongs to the author, which is exactly the opt-in channel's purpose: the
// title names the behavior change and the edit waits to be chosen instead of
// being thrown away.
//
//  1. Report on `left == right` between two `unknown` values.
//  2. Assert nothing is applied automatically and the suggestion yields `===`.
//  3. Assert the `!=` arm carries its own operator in the title and the edit.
//  4. Assert the provably safe `typeof` twin is still autofixed outright.
//
// @evidence contracts/testing.md#behavioral-verification Both loose operators require exactly one titled opt-in suggestion and zero automatic edits, while the typeof twin fixes directly.
// @evidence contracts/testing.md#independent-expectations Literal ===/!== target sources and warning titles independently state the selected coercion change; typeof produces a string suitable for the safe twin.
// @evidence contracts/testing.md#distinguishing-cases Unknown-typed == and != are suggestion-only; the typeof comparison fixes automatically, preserving the distinction between user choice and imposed behavior.
// @evidence contracts/testing.md#execution-ownership TestEqeqeqOffersUnsafeOperatorRewriteAsSuggestion is selected in the shared Go unit population. It calls assertSuggestionSnapshot for both coercion-sensitive operators and assertFixSnapshot for typeof, applying the actual suggested or automatic edits in-process. No consumer install, native artifact build or real product host runs.
func TestEqeqeqOffersUnsafeOperatorRewriteAsSuggestion(t *testing.T) {
  assertSuggestionSnapshot(
    t,
    "eqeqeq",
    "declare const left: unknown;\ndeclare const right: unknown;\nif (left == right) { JSON.stringify(left); }\n",
    "Replace with `===`, which changes the result when the operands differ in type.",
    "declare const left: unknown;\ndeclare const right: unknown;\nif (left === right) { JSON.stringify(left); }\n",
  )
  assertSuggestionSnapshot(
    t,
    "eqeqeq",
    "declare const left: unknown;\ndeclare const right: unknown;\nif (left != right) { JSON.stringify(left); }\n",
    "Replace with `!==`, which changes the result when the operands differ in type.",
    "declare const left: unknown;\ndeclare const right: unknown;\nif (left !== right) { JSON.stringify(left); }\n",
  )
  assertFixSnapshot(
    t,
    "eqeqeq",
    "declare const value: unknown;\nif (typeof value == \"string\") { JSON.stringify(value); }\n",
    "declare const value: unknown;\nif (typeof value === \"string\") { JSON.stringify(value); }\n",
  )
}
