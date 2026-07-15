package linthost

import "testing"

// TestNoUselessRenameDeclinesFixWhenCommentBetweenNames verifies the
// no-useless-rename autofix is withheld when a comment sits between the two
// names it would delete, so the comment is preserved rather than dropped.
//
// The fix deletes the rename tail from the property name's end through the
// local name's end, so a comment there (`{ a as /* keep */ a }`) would be
// erased. ESLint's no-useless-rename declines via `commentsExistBetween`; the
// port reports the redundant rename but offers no edit. The negative twin — the
// same specifier with no comment — must still collapse, proving the guard fires
// only on the comment.
//
//  1. Report on `import { a as /* keep */ a }` and assert no edit is applied.
//  2. Assert the source is left byte-for-byte intact.
//  3. Assert the comment-free twin still collapses to `import { a }`.
func TestNoUselessRenameDeclinesFixWhenCommentBetweenNames(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-useless-rename",
    "import { a as /* keep */ a } from \"./m\";\nJSON.stringify(a);\n",
  )
  assertFixSnapshot(
    t,
    "no-useless-rename",
    "import { a as a } from \"./m\";\nJSON.stringify(a);\n",
    "import { a } from \"./m\";\nJSON.stringify(a);\n",
  )
}
