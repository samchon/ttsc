package evidence

import (
  "testing"
)

/**
 * Verifies a review of an inner declarator survives a block written on it.
 *
 * The unit-level cases state the rule; this states what an author experiences,
 * through the packaged policy rather than through the collector. Writing a
 * block on the cited declarator is where a review of it belongs, and it
 * expiring that very review is the non-terminating repair loop `requireReview`
 * exists to avoid.
 *
 * Both declarators are cited and reviewed, so the assertion is about the whole
 * statement rather than about one identity with an unacknowledged sibling
 * beside it.
 *
 *  1. Take the fingerprint the graph asks for, for each cited declarator.
 *  2. Add a documentation block on the inner one.
 *  3. Assert the graph stays clean.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification everyExpectedFingerprint, runIndexRule exercises the authored fixture. Assert the graph stays clean.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The unit-level cases state the rule; this states what an author experiences, through the packaged policy rather than through the collector. Writing a block on the cited declarator is where a review of it belongs, and it expiring that very review is the non-terminating repair loop `requireReview` exists to avoid. The setup obtains fingerprint text from the graph itself, so this checks invalidation and acceptance, not the digest algorithm or an independently known hash. The authored scenario requires this outcome: Assert the graph stays clean.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Take the fingerprint the graph asks for, for each cited declarator. Add a documentation block on the inner one. Assert the graph stays clean.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAReviewOfAnInnerDeclaratorSurvivesABlockWrittenOnIt runs as a Go unit entry in the native package. everyExpectedFingerprint, runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestAReviewOfAnInnerDeclaratorSurvivesABlockWrittenOnIt(t *testing.T) {
  expected := everyExpectedFingerprint(t, map[string]string{
    "src/spec/rates.ts": `export const alpha = 1,
  beta = 2;
`,
    "src/claim/IView.ts": bothSiblingsUncited,
  }, innerDeclaratorReviewConfig)
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/spec/rates.ts": `export const alpha = 1,
  /**
   * The published rate.
   */
  beta = 2;
`,
    "src/claim/IView.ts": bothSiblingsCited(
      expected["{@link alpha}"],
      expected["{@link beta}"],
    ),
  }, innerDeclaratorReviewConfig))
}
