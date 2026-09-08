package evidence

import "testing"

/**
 * Verifies percent-encoded paths use one citation/review identity.
 *
 * Standalone links and review annotations share the same grammar. Decoding
 * only the link makes an equivalent review orphaned when the extension is encoded.
 *
 * 1. Cite a TypeScript target with encoded directory and extension characters.
 * 2. Review it with equivalent encoded and canonical spellings.
 * 3. Verify both annotations pair on the same declaration.
 */
func TestFileLinksPairEncodedPathsWithReviews(t *testing.T) {
  for _, review := range []string{"./target%2Ets#value", "target.ts#value", "%74arget.%74s#value"} {
    source := "/** @link target%2Ets#value Reads value.\n@evidenceReview " + review + " Checked value. */\nexport interface Review {}"
    assertNoProblems(t, runReviewRule(t, "review.ts", source))
  }
}
