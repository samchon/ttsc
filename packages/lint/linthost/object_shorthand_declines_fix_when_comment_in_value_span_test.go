package linthost

import "testing"

// TestObjectShorthandDeclinesFixWhenCommentInValueSpan verifies the
// object-shorthand autofix is withheld when a comment sits inside the `: value`
// span it would delete, so automatic fixing preserves the original long form.
//
// The fix deletes from the key name's end through the initializer's end, so a
// comment there (`{ x: /* keep */ x }`) would be erased. ESLint's
// object-shorthand declines when the property contains comments; the port imposes no
// edit either and routes the collapse to the opt-in suggestion channel instead
// (pinned by `TestObjectShorthandOffersWithheldCollapseAsSuggestion`).
// The negative twin — the same property
// with no comment — must still collapse to `{ x }`, proving the guard is scoped
// to the comment.
//
//  1. Report on `{ x: /* keep */ x }` and assert no edit is applied.
//  2. Assert the source is left byte-for-byte intact.
//  3. Assert the comment-free twin still collapses to the shorthand `{ x }`.
//
// @evidence contracts/testing.md#behavioral-verification The shorthand rule reports the commented long-form property but automatic fixing preserves all bytes; its comment-free twin must collapse to shorthand.
// @evidence contracts/testing.md#independent-expectations The original source is the independent preservation oracle and the literal target { x } specifies the valid no-comment rewrite.
// @evidence contracts/testing.md#distinguishing-cases Comment inside the deleted value span withholds an automatic edit; removing only that comment permits the normal rewrite. The suggestion test owns opt-in comment removal.
// @evidence contracts/testing.md#execution-ownership TestObjectShorthandDeclinesFixWhenCommentInValueSpan runs the two literal sources through assertNoFixSnapshot and assertFixSnapshot: the parser/Engine and automatic edit applier use temp files and compare complete unchanged or authored shorthand output bytes. No consumer install, native build or product host runs.
func TestObjectShorthandDeclinesFixWhenCommentInValueSpan(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "object-shorthand",
    "const x = 1;\nconst o = { x: /* keep */ x };\nJSON.stringify(o);\n",
  )
  assertFixSnapshot(
    t,
    "object-shorthand",
    "const x = 1;\nconst o = { x: x };\nJSON.stringify(o);\n",
    "const x = 1;\nconst o = { x };\nJSON.stringify(o);\n",
  )
}
