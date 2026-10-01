package linthost

import "testing"

// TestNoUselessRenameDeclinesFixWhenCommentBetweenNames verifies the
// no-useless-rename autofix is withheld when a comment sits between the two
// names it would delete, so the comment is preserved rather than dropped.
//
// The fix deletes the rename tail from the property name's end through the
// local name's end, so a comment there (`{ a as /* keep */ a }`) would be
// erased. ESLint's no-useless-rename declines via `commentsExistBetween`; the
// port imposes no edit either and routes the collapse to the opt-in suggestion
// channel instead (pinned by
// `TestNoUselessRenameOffersWithheldTailDeletionAsSuggestion`). The negative twin — the
// same specifier with no comment — must still collapse, proving the guard fires
// only on the comment.
//
//  1. Report on `import { a as /* keep */ a }` and assert no edit is applied.
//  2. Assert the source is left byte-for-byte intact.
//  3. Assert the comment-free twin still collapses to `import { a }`.
//
// @evidence contracts/testing.md#behavioral-verification The actual automatic fix pass leaves the commented redundant import alias byte-identical, while the comment-free twin collapses to an unaliased import.
// @evidence contracts/testing.md#independent-expectations Original unchanged text and authored import { a } output independently establish comment preservation and the permitted rewrite.
// @evidence contracts/testing.md#distinguishing-cases The between-name comment blocks imposed deletion; its absence permits the rewrite. The suggestion test owns author-approved comment removal.
// @evidence contracts/testing.md#execution-ownership TestNoUselessRenameDeclinesFixWhenCommentBetweenNames assertNoFixSnapshot and assertFixSnapshot write each source to a temp project file, run the no-useless-rename engine over it through runRuleFindingsSnapshotFile, apply the findings to disk with applyFindingFixes and compare the resulting file text with the authored source or output. No consumer install, native build or product host runs.
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
