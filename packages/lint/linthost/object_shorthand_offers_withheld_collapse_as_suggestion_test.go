package linthost

import "testing"

// TestObjectShorthandOffersWithheldCollapseAsSuggestion verifies the shorthand
// collapse withheld from `{ x: /* keep */ x }` is offered as an opt-in
// suggestion that discards the comment.
//
// The fix deletes from the key's end through the initializer's end, which is
// precisely where the comment lives, so `ttsc fix` must not apply it. The
// author choosing the action is a different contract from a tool rewriting the
// file unasked, so the identical edit is advertised with a title that says the
// comment goes with it.
//
//  1. Report on `{ x: /* keep */ x }` and assert nothing is auto-applied.
//  2. Assert the single suggestion collapses the property to `{ x }`.
//  3. Assert the comment-free twin is still autofixed without asking.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one titled suggestion collapses the commented property to shorthand while automatic application preserves source; the no-comment twin fixes automatically.
// @evidence contracts/testing.md#independent-expectations The authored title warns of comment loss and the literal { x } output encodes the explicit author-selected rewrite independently of generated edits.
// @evidence contracts/testing.md#distinguishing-cases Commented value spans differ from ordinary x: x; both automatic withholding and deliberate suggestion application remain asserted.
// @evidence contracts/testing.md#execution-ownership TestObjectShorthandOffersWithheldCollapseAsSuggestion uses assertSuggestionSnapshot to require one finding, zero automatic fixes, one literal titled action and complete output after explicit action edits in memory; assertFixSnapshot checks the comment-free automatic rewrite on disk. No CLI or LSP action request, consumer install, native build or product host runs.
func TestObjectShorthandOffersWithheldCollapseAsSuggestion(t *testing.T) {
  assertSuggestionSnapshot(
    t,
    "object-shorthand",
    "const x = 1;\nconst o = { x: /* keep */ x };\nJSON.stringify(o);\n",
    "Use property shorthand, discarding the comment before the value.",
    "const x = 1;\nconst o = { x };\nJSON.stringify(o);\n",
  )
  assertFixSnapshot(
    t,
    "object-shorthand",
    "const x = 1;\nconst o = { x: x };\nJSON.stringify(o);\n",
    "const x = 1;\nconst o = { x };\nJSON.stringify(o);\n",
  )
}
