package linthost

import "testing"

// TestObjectShorthandDeclinesFixWhenCommentInValueSpan verifies the
// object-shorthand autofix is withheld when a comment sits inside the `: value`
// span it would delete, so the comment survives the collapse to shorthand.
//
// The fix deletes from the key name's end through the initializer's end, so a
// comment there (`{ x: /* keep */ x }`) would be erased. ESLint's
// object-shorthand declines via `commentsExistBetween`; the port reports the
// shorthand candidate but offers no edit. The negative twin — the same property
// with no comment — must still collapse to `{ x }`, proving the guard is scoped
// to the comment.
//
//  1. Report on `{ x: /* keep */ x }` and assert no edit is applied.
//  2. Assert the source is left byte-for-byte intact.
//  3. Assert the comment-free twin still collapses to the shorthand `{ x }`.
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
