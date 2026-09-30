package evidence

import (
  "testing"
)

/**
 * Verifies a reformat that changes no content does not expire a review.
 *
 * The negative twin of RequireReviewExpiresOnCitedContent, and the one that decides whether the
 * feature is usable. A digest over raw bytes expires every review in a project
 * the first time someone runs a formatter, or the first time the repository is
 * checked out with a different `core.autocrlf`, and a rule that cries wolf on a
 * whitespace change gets switched off.
 *
 *  1. Take the fingerprint for one document.
 *  2. Re-emit the same document with CRLF line endings and trailing spaces.
 *  3. Assert the graph stays clean, so the fingerprint was unchanged.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule accepts the review seeded from LF content against equivalent CRLF content with trailing spaces.
 * @evidence contracts/testing.md#independent-expectations Line-ending and trailing-space normalization must preserve cited Markdown meaning, independent of the implementation-produced initial token.
 * @evidence contracts/testing.md#distinguishing-cases LF-to-CRLF plus trailing blanks challenges raw-byte fingerprints; semantic prose mutation belongs to RequireReviewExpiresOnCitedContent.
 * @evidence contracts/testing.md#execution-ownership TestRequireReviewSurvivesReformatting is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestRequireReviewSurvivesReformatting(t *testing.T) {
  before := "## Pricing\n\nThe rate is capped at 30%.\n"
  bare := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}
`
  fingerprint := reviewedFingerprint(t, before, bare)
  reviewed := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing #` + fingerprint + ` Section caps the rate at 30%; price clamps to 30.
 */
export interface ISale {
  price: number;
}
`
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing  \r\n\r\nThe rate is capped at 30%.   \r\n\r\n",
    "src/ISale.ts": reviewed,
  }, requireReviewConfig))
}
