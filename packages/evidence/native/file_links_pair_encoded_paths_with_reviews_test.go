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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification reviewRule.Check through runReviewRule exercises this case. Verifies percent-encoded paths use one citation/review identity.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Percent-decoded target.ts spellings denote the same review identity. The review rule must accept each pairing; this case does not load the referenced file.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite target.ts with an encoded extension. Review it with equivalent encoded and canonical spellings. Verify both annotations pair on the same declaration.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFileLinksPairEncodedPathsWithReviews is the selectable Go entry and owns its fixture variants and local closures. It invokes reviewRule.Check through runReviewRule in the native Go process. It consumes authored strings or parsed source nodes directly; no installed consumer, compiled host, or loader process participates.
 */
func TestFileLinksPairEncodedPathsWithReviews(t *testing.T) {
  for _, review := range []string{"./target%2Ets#value", "target.ts#value", "%74arget.%74s#value"} {
    source := "/** @link target%2Ets#value Reads value.\n@evidenceReview " + review + " Checked value. */\nexport interface Review {}"
    assertNoProblems(t, runReviewRule(t, "review.ts", source))
  }
}
