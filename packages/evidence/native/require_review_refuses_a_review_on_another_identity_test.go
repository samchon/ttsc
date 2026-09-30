package evidence

import (
  "testing"
)

/**
 * Verifies a review on an unrelated identity does not answer another's citation.
 *
 * The negative twin. Widening the match from a source position to a semantic
 * identity must not widen it to the whole file, or one review would discharge
 * every citation of that target anywhere in the module and the rule would be
 * satisfied by reviewing the easiest host.
 *
 *  1. Cite the target from one exported interface.
 *  2. Write the review on a different exported interface in the same file.
 *  3. Assert the citation is still reported as unreviewed.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule places the citation on ISale and a same-target review on IOther; ISale must remain unreviewed.
 * @evidence contracts/testing.md#independent-expectations A module-wide target match is insufficient: unrelated exported identities cannot answer each other's review.
 * @evidence contracts/testing.md#distinguishing-cases Two interfaces in the same file isolate semantic identity from target and file equality; this entry asserts presence of unreviewed, not the complete finding set.
 * @evidence contracts/testing.md#execution-ownership TestRequireReviewRefusesAReviewOnAnotherIdentity is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestRequireReviewRefusesAReviewOnAnotherIdentity(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing\n\nThe rate is capped at 30%.\n",
    "src/ISale.ts": `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}

/**
 * @evidenceReview docs/spec.md#pricing Checked the cap from somewhere else.
 */
export interface IOther {
  label: string;
}
`,
  }, requireReviewConfig), "Unreviewed @evidence for 'docs/spec.md#pricing'")
}
