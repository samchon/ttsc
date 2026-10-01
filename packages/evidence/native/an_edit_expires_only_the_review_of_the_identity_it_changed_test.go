package evidence

import (
  "testing"
)

/**
 * Verifies an edit expires the review of the identity it changed, and only
 * that one.
 *
 * This is the sharpest form of the sibling rule, and it is a negative twin in
 * both directions at once. A digest that covers the whole statement expires
 * both reviews here, and a digest that covers nothing expires neither; only a
 * digest taken from the edited declarator alone produces exactly one
 * diagnostic. It also keeps the complementary case from passing on a policy that never
 * expires anything.
 *
 *  1. Take the fingerprint the graph asks for, for each cited declarator.
 *  2. Change the first declarator's initializer and nothing else.
 *  3. Assert exactly one diagnostic, naming that declarator.
 * @evidence contracts/testing.md#behavioral-verification everyExpectedFingerprint runs the graph rule over a two-declarator spec (`alpha = 1, beta = 2`) with both declarators cited and unreviewed to collect the fingerprints it asks for; the test records them as reviews, changes only alpha's initializer to 9, and assertReported requires exactly one diagnostic, `Stale @evidenceReview for '{@link alpha}'`.
 * @evidence contracts/testing.md#independent-expectations The fingerprints come from the graph's own messages, so the test checks invalidation and acceptance rather than the hash algorithm; the expected single stale review for alpha follows from the review-expiry contract that an edit expires only the identity it changed.
 * @evidence contracts/testing.md#distinguishing-cases Two reviews recorded, one declarator edited: a digest covering the whole statement would report two stale reviews, one covering nothing would report none, and the exactly-one assertion naming alpha excludes both.
 * @evidence contracts/testing.md#execution-ownership TestAnEditExpiresOnlyTheReviewOfTheIdentityItChanged is a Go unit entry in the native test process; it calls the graph rule through runIndexRule twice over temp fixture files, with no consumer install or product host.
 */
func TestAnEditExpiresOnlyTheReviewOfTheIdentityItChanged(t *testing.T) {
  expected := everyExpectedFingerprint(t, map[string]string{
    "src/spec/rates.ts": `export const alpha = 1,
  beta = 2;
`,
    "src/claim/IView.ts": bothSiblingsUncited,
  }, innerDeclaratorReviewConfig)
  assertReported(t, runIndexRule(t, map[string]string{
    "src/spec/rates.ts": `export const alpha = 9,
  beta = 2;
`,
    "src/claim/IView.ts": bothSiblingsCited(
      expected["{@link alpha}"],
      expected["{@link beta}"],
    ),
  }, innerDeclaratorReviewConfig), "Stale @evidenceReview for '{@link alpha}'")
}
