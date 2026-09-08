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
