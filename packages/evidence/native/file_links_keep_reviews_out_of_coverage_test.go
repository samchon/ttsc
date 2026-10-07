package evidence

import "testing"

/**
 * Verifies review annotations cannot replace file-qualified acknowledgements.
 *
 * Both spellings share a review key, but the review has no acknowledgement
 * kind of its own. Exclusion reviews answer only their matching exclusion.
 *
 * 1. Cite a property from a TypeScript documentation block without imports.
 * 2. Pair each acknowledgement kind with its corresponding review.
 * 3. Remove the acknowledgement and verify coverage remains owed.
 *
 * @evidence contracts/testing.md#behavioral-verification For each of `@link`, `@evidence` and `@evidenceExclude`, runIndexRule is run over a review.ts block carrying that tag for `target.ts#value` plus its matching review tag, which must give no diagnostics, and then over a block carrying only the review tag, which must report `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the review contract: a review has no acknowledgement kind of its own, so removing the link, evidence or exclusion while keeping its matching review must leave the property owed.
 * @evidence contracts/testing.md#distinguishing-cases Three acknowledgement kinds, each as an acknowledged-and-reviewed form and a review-only form; the exclusion kind pairs with its own exclusion-review tag.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksKeepReviewsOutOfCoverage is a Go unit entry in the native test process that loops over three tags (not named subtests); runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestFileLinksKeepReviewsOutOfCoverage(t *testing.T) {
  config := `{"claims":[{"type":"typescript","files":["src/review.ts"],"symbol":"type","reference":{"type":"typescript","files":["src/target.ts"],"symbol":"property"}}]}`
  for _, tag := range []string{"@link", "@evidence", "@evidenceExclude"} {
    review := "@evidenceReview"
    if tag == "@evidenceExclude" {
      review = "@evidenceExcludeReview"
    }
    files := map[string]string{
      "src/target.ts": "export const value = 1;\n",
      "src/review.ts": "/**\n" + tag + " ./target.ts#value Records the decision.\n" + review + " target.ts#value Checked this decision.\n*/\nexport interface Review {}",
    }
    assertNoProblems(t, runIndexRule(t, files, config))
    files["src/review.ts"] = "/** " + review + " target.ts#value Checked this decision. */\nexport interface Review {}"
    assertProblemContains(t, runIndexRule(t, files, config), "Missing acknowledgement")
  }
}
