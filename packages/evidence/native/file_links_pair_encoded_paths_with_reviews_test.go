package evidence

import "testing"

/**
 * Verifies percent-encoded paths use one citation/review identity.
 *
 * Standalone links and review annotations share the same grammar. Decoding
 * only the link makes an equivalent review orphaned when the extension is encoded.
 *
 * 1. Cite target.ts with an encoded extension.
 * 2. Review it with equivalent encoded and canonical spellings.
 * 3. Verify both annotations pair on the same declaration.
 *
 * @evidence contracts/testing.md#behavioral-verification For three review spellings (`./target%2Ets#value`, `target.ts#value` and `%74arget.%74s#value`), runReviewRule is run over a block with `@link target%2Ets#value` followed by `@evidenceReview <spelling>`; each run must give no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the shared grammar contract: percent-decoded spellings of the same path are one identity, so a review written in an equivalent encoded or canonical form must pair with the link; the referenced file is not loaded here.
 * @evidence contracts/testing.md#distinguishing-cases Three spellings (dot-slash prefix, canonical, and fully percent-encoded name) of one target, looped as plain iterations; only absence of review-pairing diagnostics is asserted.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPairEncodedPathsWithReviews is a Go unit entry in the native test process that loops over three spellings; runReviewRule parses each source and calls the review rule directly, with no filesystem, consumer install or product host.
 */
func TestFileLinksPairEncodedPathsWithReviews(t *testing.T) {
  for _, review := range []string{"./target%2Ets#value", "target.ts#value", "%74arget.%74s#value"} {
    source := "/** @link target%2Ets#value Reads value.\n@evidenceReview " + review + " Checked value. */\nexport interface Review {}"
    assertNoProblems(t, runReviewRule(t, "review.ts", source))
  }
}
