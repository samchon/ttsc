package evidence

import (
  "testing"
)

/**
 * Verifies a Markdown host carries the exclusion review kind into its inventory.
 *
 * Three loaders set the review's kind and a missed one is silent, so each carrier
 * needs its own proof. Markdown is also the carrier where the reason boundary was
 * broken once: an HTML comment has no field syntax, so only this grammar's own tags
 * close a reason, and `@evidenceExcludeReview` had to join that set. If it had not,
 * the review would be swallowed into the exclusion's reason above it and vanish.
 *
 *  1. Scan a document whose HTML comment holds an exclusion and then its review.
 *  2. Assert the exclusion's reason stops at its own sentence.
 *  3. Assert the review was collected, addressed to the exclusion rather than to a
 *     citation.
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown parses an HTML-comment exclusion/review pair; one declaration with the literal bounded reason and one tagExclude review are required.
 * @evidence contracts/testing.md#independent-expectations The review marker terminates the exclusion reason and preserves its distinct review kind.
 * @evidence contracts/testing.md#distinguishing-cases Adjacent tags in one comment detect swallowed reasons and lost review kinds; the graph's requireReview matching is not invoked.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownCarriesTheExclusionReviewKind is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
 */
func TestMarkdownCarriesTheExclusionReviewKind(t *testing.T) {
  inventory, problems := scanProjectMarkdown("docs/ref.md", `# Ledger

<!--
@evidenceExclude docs/spec.md#tax The tax engine owns this, not this ledger.
@evidenceExcludeReview docs/spec.md#tax Read the section: every rule names a tax authority.
-->
`)
  assertNoProblems(t, problems)
  if len(inventory.Declarations) != 1 {
    t.Fatalf("expected one exclusion, got %d", len(inventory.Declarations))
  }
  if reason := inventory.Declarations[0].Reason; reason != "The tax engine owns this, not this ledger." {
    t.Fatalf("the review leaked into the exclusion's reason: %q", reason)
  }
  if len(inventory.Reviews) != 1 {
    t.Fatalf("expected one review, got %d", len(inventory.Reviews))
  }
  if kind := inventory.Reviews[0].Reviews; kind != tagExclude {
    t.Fatalf("the review was addressed to %q rather than to the exclusion", kind)
  }
}
