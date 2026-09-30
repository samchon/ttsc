package evidence

import (
  "testing"
)

/**
 * Verifies a review filed under the wrong question is reported as mismatched,
 * not as an orphan.
 *
 * This is the mistake the split makes possible and therefore has to name well. The
 * author did the work; they filed it against the wrong acknowledgement. Reporting
 * "this identity carries no such target" would send them looking for a typo that is
 * not there, so the finding says which tag answers for that target and what to
 * rewrite.
 *
 *  1. Review an exclusion with `@evidenceReview` and a citation with
 *     `@evidenceExcludeReview`, each naming a target the host really does
 *     acknowledge.
 *  2. Assert both are reported as mismatched and named by the tag that answers.
 *  3. Assert neither is reported as an orphan.
 * @evidence contracts/testing.md#behavioral-verification runReviewRule swaps review kinds for a citation and an exclusion; both mismatched findings and matching-kind repair text must appear without orphan findings.
 * @evidence contracts/testing.md#independent-expectations A target acknowledged under the opposite kind is mismatched rather than absent; repairs must name the correct marker.
 * @evidence contracts/testing.md#distinguishing-cases Both swap directions challenge asymmetric recognition while zero orphan count protects error classification; the total findings are not counted.
 * @evidence contracts/testing.md#execution-ownership TestReviewReportsAMismatchedReviewTag is a selectable native Go unit entry. runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter; no target artifact, installed consumer or real compiler host is needed.
 */
func TestReviewReportsAMismatchedReviewTag(t *testing.T) {
  messages := runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceExcludeReview docs/spec.md#pricing Filed under the wrong question.
 * @evidenceExclude docs/spec.md#tax The tax engine owns this, not the sale record.
 * @evidenceReview docs/spec.md#tax Also filed under the wrong question.
 */
export interface ISale {
  price: number;
}
`)
  assertReportedAmong(
    t,
    messages,
    "Mismatched @evidenceExcludeReview for 'docs/spec.md#pricing'",
  )
  assertReportedAmong(
    t,
    messages,
    "Mismatched @evidenceReview for 'docs/spec.md#tax'",
  )
  assertReportedAmong(t, messages, "Rewrite this review as '@evidenceReview docs/spec.md#pricing")
  assertReportedAmong(
    t,
    messages,
    "Rewrite this review as '@evidenceExcludeReview docs/spec.md#tax",
  )
  if count := countProblemsContaining(messages, "Orphan"); count != 0 {
    t.Fatalf("a misfiled review was reported as an orphan %d time(s)", count)
  }
}
