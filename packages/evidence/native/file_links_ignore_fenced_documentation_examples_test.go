package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies fenced JSDoc examples neither cite, review, nor withdraw declarations.
 *
 * The acknowledgement, review, and hiding-tag readers consume the same comment.
 * A fence must have the same boundary in each reader to avoid silent deactivation.
 *
 * 1. Place link/review/internal examples inside a documentation fence.
 * 2. Add a real citation and review after it and assert both rules pass.
 * 3. Remove the real citation and verify the example supplies no coverage.
 *
 * @evidence contracts/testing.md#behavioral-verification A review.ts interface block holds a fenced example with `@link missing.ts#never`, `@evidenceReview` and `@internal`, followed by a real `@link target.ts#value` and its `@evidenceReview`; runIndexRule and runReviewRule must report nothing, and after replacing the real link with plain prose runIndexRule must report `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the fence contract: the citation, review and withdrawal readers must share one fence boundary, so the example links, review and `@internal` neither cite, review nor withdraw, and only the real citation acknowledges the value.
 * @evidence contracts/testing.md#distinguishing-cases The same file with and without the real citation: with it, the invalid example link must not fail and the example `@internal` must not withdraw the declaration; without it, the example must not supply coverage.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksIgnoreFencedDocumentationExamples is a Go unit entry in the native test process; runIndexRule and runReviewRule write the fixtures to temp directories and call the owning rules directly, with no consumer install or product host.
 */
func TestFileLinksIgnoreFencedDocumentationExamples(t *testing.T) {
  source := "/**\n * ```ts\n * @link missing.ts#never Example only.\n * @evidenceReview missing.ts#never Example review.\n * @internal\n * ```\n * @link target.ts#value Valid citation.\n * @evidenceReview target.ts#value Verified the initializer.\n */\nexport interface Review {}\n"
  config := `{"claims":[{"type":"typescript","files":["review.ts"],"symbol":"type","reference":{"type":"typescript","files":["target.ts"],"symbol":"property"}}]}`
  files := map[string]string{"target.ts": "export const value = 1;", "review.ts": source}
  assertNoProblems(t, runIndexRule(t, files, config))
  assertNoProblems(t, runReviewRule(t, "review.ts", source))
  files["review.ts"] = strings.Replace(source, "@link target.ts#value Valid citation.", "No actual citation.", 1)
  assertProblemContains(t, runIndexRule(t, files, config), "Missing acknowledgement")
}
