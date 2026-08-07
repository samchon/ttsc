package evidence

import (
  "testing"
)

/**
 * Verifies `requireReview` judges an exclusion, and names the exclusion review tag
 * in its repair.
 *
 * The Individual Self-Review found this untested and it is the half that can
 * silently regress: `reviewProblems` has no tag filter, so an `@evidenceExclude`
 * under a reviewing reference reaches it, and nothing exercised
 * `reviewMarkerFor(declaration.Tag)` with an exclusion or the ledger key with
 * `"evidenceExclude"` in it. A missed `Reviews` field at any construction site
 * fails closed — the key matches nothing and every review reports unreviewed — so
 * the failure would look like a rule working correctly on a project that is wrong.
 *
 *  1. Exclude one H2 under a `requireReview` reference and read the fingerprint the
 *     graph asks for.
 *  2. Answer it with `@evidenceExcludeReview` and assert the graph is clean.
 *  3. Answer it with `@evidenceReview` instead and assert it is still unreviewed,
 *     so the citation's tag cannot discharge an exclusion.
 */
func TestRequireReviewJudgesAnExclusion(t *testing.T) {
  document := "## Pricing\n\nThe rate is capped at 30%.\n"
  bare := `/**
 * @evidenceExclude docs/spec.md#pricing The pricing engine owns this, not the view model.
 */
export interface ISale {
  price: number;
}
`
  unreviewed := runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": bare,
  }, requireReviewConfig)
  assertProblemContains(t, unreviewed, "Unreviewed @evidenceExclude for 'docs/spec.md#pricing'")
  assertProblemContains(t, unreviewed, "Add '@evidenceExcludeReview docs/spec.md#pricing #")
  fingerprint := ""
  for _, message := range unreviewed {
    if asksForAFingerprint(message) {
      fingerprint = shapedFingerprint(message)
      break
    }
  }
  if fingerprint == "" {
    t.Fatalf("expected the exclusion finding to name a fingerprint, got:\n%v", unreviewed)
  }

  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": `/**
 * @evidenceExclude docs/spec.md#pricing The pricing engine owns this, not the view model.
 * @evidenceExcludeReview docs/spec.md#pricing #` + fingerprint + ` Read the section: every rule in it names a price authority, none names this view.
 */
export interface ISale {
  price: number;
}
`,
  }, requireReviewConfig))

  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": `/**
 * @evidenceExclude docs/spec.md#pricing The pricing engine owns this, not the view model.
 * @evidenceReview docs/spec.md#pricing Filed under the wrong question.
 */
export interface ISale {
  price: number;
}
`,
  }, requireReviewConfig), "Unreviewed @evidenceExclude for 'docs/spec.md#pricing'")
}

/**
 * Verifies a Markdown host carries the exclusion review kind through to the graph.
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
