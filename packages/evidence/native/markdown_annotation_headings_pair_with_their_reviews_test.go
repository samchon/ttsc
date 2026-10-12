package evidence

import (
  "strings"
  "testing"
)

// annotationReviewConfig is a Markdown claim whose specification reference
// demands a current review of every acknowledgement.
const annotationReviewConfig = `{"claims":[{
  "type":"markdown",
  "files":["docs/claim/**/*.md"],
  "symbol":"h2",
  "reference":{"type":"markdown","files":["docs/spec/**/*.md"],"symbol":"h2","requireReview":true}
}]}`

/**
 * TestMarkdownAnnotationHeadingsPairWithTheirReviews verifies a visible
 * citation pairs with a review written beside it, in either carrier.
 *
 * A review pairs with a citation on the same host. A comment inside the
 * section and a visible `@evidenceReview` heading next to the citation belong
 * to the section the citation answers for, so both must pair and both must
 * expire when the cited section changes. A review heading one level too
 * shallow is a sibling of that section and belongs to its parent instead, so it
 * must not pair.
 *
 *  1. Read the fingerprint the graph asks for from a citation without review.
 *  2. Add the review as a comment in the section, then as a visible heading,
 *     and require silence for both; change the cited section and require both
 *     to be stale.
 *  3. Raise the review heading to the section's own depth and require the
 *     citation to be reported as unreviewed.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs graphRule.Check under a Markdown claim with requireReview; the plan answers the pricing section with a visible H3 citation and a review written either as an HTML comment inside that section or as a sibling H3 `@evidenceReview` heading, and the case asserts silence, stale reviews after the specification changes, and the citation reported as unreviewed when the review heading is an H2.
 * @evidence contracts/testing.md#independent-expectations Review pairing requires the same host, and the ownership rule gives the comment and the sibling H3 the citation's owner and the H2 review the file; the expected silence, staleness and finding follow from those rules, with the fingerprint used only as the graph's own requested token.
 * @evidence contracts/testing.md#distinguishing-cases Comment versus visible review carriers, current versus changed cited content, and an H3 versus an H2 review heading, which differ only in depth and therefore in owner.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownAnnotationHeadingsPairWithTheirReviews is a native Go unit entry; runIndexRule writes temporary fixtures and calls the graph rule in-process without an installed consumer or product host.
 */
func TestMarkdownAnnotationHeadingsPairWithTheirReviews(t *testing.T) {
  rules := "## Pricing {#pricing}\n\nThe rate is capped at 30%.\n"
  cited := "# Plans\n\n## Plan {#plan}\n\nThe plan body.\n\n### @evidence docs/spec/rules.md#pricing\n\nPlans around the cap.\n"
  fingerprint := reviewedFingerprintAt(t, map[string]string{
    "docs/spec/rules.md": rules,
    "docs/claim/plan.md": cited,
  }, annotationReviewConfig)
  for name, review := range map[string]string{
    "comment": "\n<!-- @evidenceReview docs/spec/rules.md#pricing #" + fingerprint + " Read the cap. -->\n",
    "heading": "\n### @evidenceReview docs/spec/rules.md#pricing #" + fingerprint + "\n\nRead the cap.\n",
  } {
    t.Run(name, func(t *testing.T) {
      plan := cited + review
      assertNoProblems(t, runIndexRule(t, map[string]string{
        "docs/spec/rules.md": rules,
        "docs/claim/plan.md": plan,
      }, annotationReviewConfig))
      assertProblemContains(t, runIndexRule(t, map[string]string{
        "docs/spec/rules.md": strings.Replace(rules, "30%", "45%", 1),
        "docs/claim/plan.md": plan,
      }, annotationReviewConfig), "Stale @evidenceReview for 'docs/spec/rules.md#pricing'")
    })
  }
  t.Run("sibling review heading", func(t *testing.T) {
    plan := cited + "\n## @evidenceReview docs/spec/rules.md#pricing #" + fingerprint + "\n\nRead the cap.\n"
    assertProblemContains(t, runIndexRule(t, map[string]string{
      "docs/spec/rules.md": rules,
      "docs/claim/plan.md": plan,
    }, annotationReviewConfig), "Unreviewed @evidence for 'docs/spec/rules.md#pricing'")
  })
}
