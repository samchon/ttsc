package evidence

import (
  "strings"
  "testing"
)

/**
 * TestHeadingAnnotationsCoverAndReviewThroughTheGraph verifies a heading-form
 * citation and review discharge a `requireReview` obligation like their line
 * forms.
 *
 * The parser is only half of the contract. The graph must accept the section's
 * target as coverage, pair the heading-form review with it on the same host,
 * ask for the fingerprint when the review is missing, report it stale when the
 * cited section changes, and report the obligation missing once the section is
 * removed.
 *
 *  1. Cite a Markdown H2 from a TypeScript interface with a heading section and
 *     read the fingerprint the graph asks for.
 *  2. Add a heading-form review with it and require silence.
 *  3. Change the cited section and require a stale review; remove the section
 *     and require missing coverage.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs graphRule.Check under requireReviewConfig over docs/spec.md and an interface whose JSDoc holds heading-form `@evidence` and `@evidenceReview` sections; the case asserts the requested fingerprint, no diagnostics with that fingerprint, the stale-review diagnostic after the section text changes, and the missing-acknowledgement diagnostic after the citation section is removed.
 * @evidence contracts/testing.md#independent-expectations Coverage, review pairing and expiry are the existing requireReview contract and are independent of how an annotation is spelled; the expected messages are the ones the line forms produce, and the fingerprint is used only as an opaque token read from the graph's own request.
 * @evidence contracts/testing.md#distinguishing-cases Missing review, current review, stale review and missing citation are four states of one fixture; the line-form equivalents are owned by the existing requireReview entries, and parsing boundaries by the parser entries.
 * @evidence contracts/testing.md#execution-ownership TestHeadingAnnotationsCoverAndReviewThroughTheGraph is a native Go unit entry; runIndexRule writes fixtures to a temporary directory and calls the graph rule in-process without an installed consumer or product host.
 */
func TestHeadingAnnotationsCoverAndReviewThroughTheGraph(t *testing.T) {
  document := "## Pricing {#pricing}\n\nThe rate is capped at 30%.\n"
  citation := ` * ## @evidence docs/spec.md#pricing
 *
 * Derives the sale price from this section.
 *
 * ### Clamping
 *
 * - Clamps the rate to the cap.
`
  source := func(review string) string {
    return "/**\n * A sale.\n *\n" + citation + review + " */\nexport interface ISale {\n  price: number;\n}\n"
  }
  fingerprint := reviewedFingerprint(t, document, source(""))
  reviewed := source(` *
 * ## @evidenceReview docs/spec.md#pricing #` + fingerprint + `
 *
 * Read the cap and the clamp together.
`)
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": reviewed,
  }, requireReviewConfig))

  stale := runIndexRule(t, map[string]string{
    "docs/spec.md": strings.Replace(document, "30%", "45%", 1),
    "src/ISale.ts": reviewed,
  }, requireReviewConfig)
  assertProblemContains(t, stale, "Stale @evidenceReview for 'docs/spec.md#pricing'")
  assertProblemContains(t, stale, "names '#"+fingerprint+"'")

  uncited := runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": "/**\n * A sale.\n */\nexport interface ISale {\n  price: number;\n}\n",
  }, requireReviewConfig)
  assertProblemContains(t, uncited, "Missing acknowledgement for 'docs/spec.md#pricing'")
}
