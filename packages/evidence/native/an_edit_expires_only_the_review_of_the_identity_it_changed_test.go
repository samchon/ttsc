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
 * @evidence contracts/testing.md#behavioral-verification everyExpectedFingerprint, runIndexRule exercises the authored fixture. Assert exactly one diagnostic, naming that declarator.
 * @evidence contracts/testing.md#independent-expectations This is the sharpest form of the sibling rule, and it is a negative twin in both directions at once. A digest that covers the whole statement expires both reviews here, and a digest that covers nothing expires neither; only a digest taken from the edited declarator alone produces exactly one diagnostic. It also keeps the complementary case from passing on a policy that never expires anything. The setup obtains fingerprint text from the graph itself, so this checks invalidation and acceptance, not the digest algorithm or an independently known hash. The authored scenario requires this outcome: Assert exactly one diagnostic, naming that declarator.
 * @evidence contracts/testing.md#distinguishing-cases Take the fingerprint the graph asks for, for each cited declarator. Change the first declarator's initializer and nothing else. Assert exactly one diagnostic, naming that declarator.
 * @evidence contracts/testing.md#execution-ownership TestAnEditExpiresOnlyTheReviewOfTheIdentityItChanged runs as a Go unit entry in the native package. everyExpectedFingerprint, runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
