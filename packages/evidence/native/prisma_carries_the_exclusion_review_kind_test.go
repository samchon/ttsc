package evidence

import (
  "testing"
)

/**
 * Verifies a Prisma documentation run carries the exclusion review kind.
 *
 * The unattached top-level run is the one position that accepts `@evidenceExclude`
 * and never `@evidence`, so it is where an exclusion review matters most and it had
 * no test. A lint-only `.schema` ledger is built entirely out of these, and under
 * `requireReview` every exclusion in one would report unreviewed forever if the
 * kind did not survive the loader.
 *
 *  1. Parse a `///` run holding an exclusion and its review.
 *  2. Assert the review is collected and addressed to the exclusion.
 *
 * @evidence contracts/testing.md#behavioral-verification parseReviews and parseCommentDeclarations consume the same documentation text; one tagExclude review with tax target and one bounded exclusion reason are required.
 * @evidence contracts/testing.md#independent-expectations Prisma documentation grammar preserves the exclusion review kind and treats its marker as a reason boundary.
 * @evidence contracts/testing.md#distinguishing-cases This is a direct grammar unit test over string input; it does not invoke the Prisma AST parser despite its fixture's artifact vocabulary.
 * @evidence contracts/testing.md#execution-ownership TestPrismaCarriesTheExclusionReviewKind is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
 */
func TestPrismaCarriesTheExclusionReviewKind(t *testing.T) {
  reviews := parseReviews(`
@evidenceExclude docs/spec.md#tax The tax engine owns this, not the schema.
@evidenceExcludeReview docs/spec.md#tax Read the section: it names no stored column.
`)
  if len(reviews) != 1 {
    t.Fatalf("expected one review, got %d", len(reviews))
  }
  if reviews[0].Reviews != tagExclude {
    t.Fatalf("the review was addressed to %q rather than to the exclusion", reviews[0].Reviews)
  }
  if reviews[0].Target != "docs/spec.md#tax" {
    t.Fatalf("unexpected review target: %q", reviews[0].Target)
  }
  // The citation above it must keep its own reason, which is the boundary the
  // review tag has to close in a `///` run exactly as it does in JSDoc.
  declarations := parseCommentDeclarations(`
@evidenceExclude docs/spec.md#tax The tax engine owns this, not the schema.
@evidenceExcludeReview docs/spec.md#tax Read the section: it names no stored column.
`, true)
  if len(declarations) != 1 {
    t.Fatalf("expected one declaration, got %d", len(declarations))
  }
  if declarations[0].Reason != "The tax engine owns this, not the schema." {
    t.Fatalf("the review leaked into the exclusion's reason: %q", declarations[0].Reason)
  }
}
