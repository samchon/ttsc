package linthost

import "testing"

// TestNoUselessRenameOffersWithheldTailDeletionAsSuggestion verifies the rename
// tail withheld from `{ a as /* keep */ a }` is offered as an opt-in suggestion
// that discards the comment.
//
// Deleting from the property name's end through the local name's end removes
// the comment with the redundant alias, so the autofix declines exactly as
// ESLint's `commentsExistBetween` guard does. The collapse itself stays
// correct, so the author is offered it rather than left with a diagnostic that
// names a problem and hands over no way to act on it.
//
//  1. Report on `import { a as /* keep */ a }` and assert nothing auto-applies.
//  2. Assert the single suggestion collapses the specifier to `import { a }`.
//  3. Assert the comment-free twin is still autofixed without asking.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one titled suggestion removes the commented redundant alias while the automatic pass changes nothing; the no-comment twin still auto-fixes.
// @evidence contracts/testing.md#independent-expectations The literal warning title identifies comment loss and the authored import { a } target independently defines the opted-in result.
// @evidence contracts/testing.md#distinguishing-cases Commented alias is suggestion-only; the same alias without the comment remains automatically fixable.
// @evidence contracts/testing.md#execution-ownership TestNoUselessRenameOffersWithheldTailDeletionAsSuggestion owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestNoUselessRenameOffersWithheldTailDeletionAsSuggestion(t *testing.T) {
  assertSuggestionSnapshot(
    t,
    "no-useless-rename",
    "import { a as /* keep */ a } from \"./m\";\nJSON.stringify(a);\n",
    "Remove the redundant rename, discarding the comment inside it.",
    "import { a } from \"./m\";\nJSON.stringify(a);\n",
  )
  assertFixSnapshot(
    t,
    "no-useless-rename",
    "import { a as a } from \"./m\";\nJSON.stringify(a);\n",
    "import { a } from \"./m\";\nJSON.stringify(a);\n",
  )
}
