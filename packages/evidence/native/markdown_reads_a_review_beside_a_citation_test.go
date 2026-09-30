package evidence

import (
  "testing"
)

/**
 * Verifies a Markdown review closes the citation above it without making every
 * `@tag` a boundary.
 *
 * An Individual Self-Review caught the first half: a review written under a
 * citation inside one HTML comment was swallowed into that citation's reason, so
 * the review vanished and the reason grew a sentence its author addressed to a
 * different question.
 *
 * The obvious repair, turning tag boundaries on for Markdown, is wrong and CI
 * said so by breaking `TestMarkdownDeclarationReasonMayBeginWithAtSign`. That
 * flag answers whether *another tool's* `@tag` ends a reason, which is a property
 * of the host's comment grammar: an HTML comment has no field syntax, so
 * `@architecture approved this` is prose the reason keeps. A review is not
 * another tool's tag. It belongs to this grammar, so it is a boundary in every
 * host and the flag does not govern it.
 *
 *  1. Scan a document whose HTML comment holds a citation and then a review.
 *  2. Assert the citation's reason stops at its own sentence and the review was
 *     collected with its own target and description.
 *  3. Assert an unrelated `@tag` is still absorbed into a Markdown reason.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown exercises this case. Verifies a Markdown review closes the citation above it without making every `@tag` a boundary.
 *
 * @evidence contracts/testing.md#independent-expectations The citation and review each have literal target/reason expectations; the foreign architecture line remains prose. Counts detect swallowed or manufactured annotations.
 *
 * @evidence contracts/testing.md#distinguishing-cases Scan a document whose HTML comment holds a citation and then a review. Assert the citation's reason stops at its own sentence and the review was collected with its own target and description. Assert an unrelated `@tag` is still absorbed into a Markdown reason.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownReadsAReviewBesideACitation is the selectable Go entry and owns its fixture variants and local closures. It invokes scanProjectMarkdown in the native Go process. It consumes authored strings or parsed source nodes directly; no installed consumer, compiled host, or loader process participates.
 */
func TestMarkdownReadsAReviewBesideACitation(t *testing.T) {
  inventory, problems := scanProjectMarkdown("docs/spec.md", `# Pricing

<!--
@evidence docs/meetings/a.md#policy Carries the limit agreed in that meeting.
@evidenceReview docs/meetings/a.md#policy Read the minutes; the limit matches.
-->
`)
  assertNoProblems(t, problems)
  if len(inventory.Declarations) != 1 {
    t.Fatalf("expected one citation, got %d", len(inventory.Declarations))
  }
  if reason := inventory.Declarations[0].Reason; reason != "Carries the limit agreed in that meeting." {
    t.Fatalf("the review leaked into the citation's reason: %q", reason)
  }
  if len(inventory.Reviews) != 1 {
    t.Fatalf("expected one review, got %d", len(inventory.Reviews))
  }
  review := inventory.Reviews[0]
  if review.Target != "docs/meetings/a.md#policy" {
    t.Fatalf("unexpected review target: %q", review.Target)
  }
  if review.Description != "Read the minutes; the limit matches." {
    t.Fatalf("unexpected review description: %q", review.Description)
  }

  // The negative twin, and the one CI had to teach me. Another tool's tag has no
  // field grammar inside an HTML comment, so it stays in the reason. Making the
  // review a boundary must not make every `@tag` one.
  foreign, foreignProblems := scanProjectMarkdown("docs/ref.md", `<!--
@evidence docs/meetings/a.md#policy Carries the limit agreed in that meeting.
@architecture approved this adoption.
-->
`)
  assertNoProblems(t, foreignProblems)
  if len(foreign.Declarations) != 1 {
    t.Fatalf("expected one citation, got %d", len(foreign.Declarations))
  }
  if reason := foreign.Declarations[0].Reason; reason != "Carries the limit agreed in that meeting.\n@architecture approved this adoption." {
    t.Fatalf("an unrelated @tag stopped being prose in a Markdown reason: %q", reason)
  }
}
