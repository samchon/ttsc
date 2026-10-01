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
 * @evidence contracts/testing.md#behavioral-verification everyExpectedFingerprint runs the graph rule over a two-declarator spec file (`alpha = 1, beta = 2`) with both declarators cited and unreviewed and collects the fingerprints it asks for; the test then writes those fingerprints as reviews, adds a documentation block on `beta`, and runIndexRule must report no diagnostic.
 * @evidence contracts/testing.md#independent-expectations The fingerprints come from the graph's own message for the undocumented spec, so the test does not know the hash algorithm: it establishes only that adding a block on the cited declarator does not invalidate a review recorded before it; a wrong or missing fingerprint would fail the clean assertion rather than pass vacuously.
 * @evidence contracts/testing.md#distinguishing-cases Both declarators of one statement are cited and reviewed, so the single clean outcome covers alpha and beta together; the block is added on the inner declarator only. Content edits that must expire a review are owned by sibling digest entries.
 * @evidence contracts/testing.md#execution-ownership TestAReviewOfAnInnerDeclaratorSurvivesABlockWrittenOnIt is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
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
