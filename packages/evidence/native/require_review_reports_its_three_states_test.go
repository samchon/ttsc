package evidence

import (
  "testing"
)

/**
 * Verifies absent and unfingerprinted reviews are reported one at a time, each naming the
 * expected fingerprint.
 *
 * The states are mutually exclusive because each repair subsumes the next:
 * without a review nothing can carry a fingerprint, and without a fingerprint
 * nothing can be compared. Reporting two of them for one citation would name two
 * repairs where performing the first produces the second.
 *
 * Every message has to state the expected value, and that is a contract rather
 * than a courtesy. The host publishes a rule's completion corpus only on a cycle
 * where the rule reports nothing, so the cycle that most needs to offer the
 * fingerprint is exactly the cycle that offers none. A diagnostic without it
 * names no repair the author can perform.
 *
 *  1. Cite one H2 with no review at all and assert the unreviewed state names a
 *     fingerprint to write.
 *  2. Review it with no fingerprint and assert the unfingerprinted state, and
 *     that the unreviewed state is gone.
 *  3. Assert neither run reports more than one review finding.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule checks absent and unfingerprinted reviews; each has exactly one review finding, and the unfingerprinted arm must not also be unreviewed.
 * @evidence contracts/testing.md#independent-expectations The review states require one repair at a time: absent review precedes missing fingerprint. The diagnostic must offer a token in the absent-review arm.
 * @evidence contracts/testing.md#distinguishing-cases Only two states execute here despite the historical Test name; stale reviews are covered by RequireReviewExpiresOnCitedContent.
 * @evidence contracts/testing.md#execution-ownership TestRequireReviewReportsItsThreeStates is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestRequireReviewReportsItsThreeStates(t *testing.T) {
  document := "## Pricing\n\nThe rate is capped at 30%.\n"
  unreviewed := runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}
`,
  }, requireReviewConfig)
  assertProblemContains(t, unreviewed, "Unreviewed @evidence for 'docs/spec.md#pricing'")
  assertProblemContains(t, unreviewed, "Add '@evidenceReview docs/spec.md#pricing #")
  if count := countProblemsContaining(unreviewed, "@evidenceReview"); count != 1 {
    t.Fatalf("expected exactly one review finding, got %d:\n%v", count, unreviewed)
  }

  unfingerprinted := runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.
 */
export interface ISale {
  price: number;
}
`,
  }, requireReviewConfig)
  assertProblemContains(
    t,
    unfingerprinted,
    "Unfingerprinted @evidenceReview for 'docs/spec.md#pricing'",
  )
  if count := countProblemsContaining(unfingerprinted, "Unreviewed @evidence"); count != 0 {
    t.Fatalf("a reviewed citation was also reported as unreviewed %d time(s)", count)
  }
  if count := countProblemsContaining(unfingerprinted, "@evidenceReview"); count != 1 {
    t.Fatalf("expected exactly one review finding, got %d:\n%v", count, unfingerprinted)
  }
}
