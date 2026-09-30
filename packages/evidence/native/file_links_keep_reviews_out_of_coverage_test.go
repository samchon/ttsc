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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies review annotations cannot replace file-qualified acknowledgements.
 *
 * @evidence contracts/testing.md#independent-expectations A review has no acknowledgement kind. Removing link, evidence, or evidenceExclude while retaining its matching review must leave the property owed.
 *
 * @evidence contracts/testing.md#distinguishing-cases Cite a property from a TypeScript documentation block without imports. Pair each acknowledgement kind with its corresponding review. Remove the acknowledgement and verify coverage remains owed.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksKeepReviewsOutOfCoverage is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
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
