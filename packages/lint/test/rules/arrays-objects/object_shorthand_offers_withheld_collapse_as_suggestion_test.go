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
