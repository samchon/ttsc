package evidence

import (
  "testing"
)

/**
 * Verifies an exclusion is answered by `@evidenceExcludeReview` and a citation by
 * `@evidenceReview`, and that neither answers the other.
 *
 * The two acknowledgements ask opposite questions and so do their reviews.
 * Verifying an `@evidence` means checking that this declaration does what the
 * cited unit describes. Verifying an `@evidenceExclude` means checking that the
 * unit genuinely does not apply here, which no reading of the declaration can
 * establish. One tag for both would let a review of the easier question discharge
 * the harder one, and would leave a reader unable to tell which was answered
 * without finding the sibling tag first.
 *
 *  1. One host cites one target and excludes another, each answered by its own
 *     review tag.
 *  2. Assert nothing is reported.
 */
func TestReviewSeparatesTheTwoReviewTags(t *testing.T) {
  assertSilent(t, runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.
 * @evidenceExclude docs/spec.md#tax The tax engine owns this, not the sale record.
 * @evidenceExcludeReview docs/spec.md#tax Read the section: every rule in it names a tax authority, none names a sale field.
 */
export interface ISale {
  price: number;
}
`))
}

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

/**
 * Verifies an unreviewed exclusion is told to write the exclusion review tag.
 *
 * A repair naming `@evidenceReview` would send the author of an exclusion to write
 * the tag that does not answer it, which is the one mistake the split exists to
 * prevent. The finding also states which question is open, because "nothing states
 * what was verified" does not say what verification would mean here.
 *
 *  1. One host carries an unreviewed exclusion and an unreviewed citation.
 *  2. Assert each repair names its own tag, and each finding states its own
 *     question.
 */
func TestReviewNamesTheMatchingTagInEveryRepair(t *testing.T) {
  messages := runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceExclude docs/spec.md#tax The tax engine owns this, not the sale record.
 */
export interface ISale {
  price: number;
}
`)
  assertReportedAmong(
    t,
    messages,
    "Add '@evidenceReview docs/spec.md#pricing <what you checked>'",
  )
  assertReportedAmong(
    t,
    messages,
    "Add '@evidenceExcludeReview docs/spec.md#tax <what you checked>'",
  )
  assertReportedAmong(
    t,
    messages,
    "The exclusion states that this claim does not cover that target.",
  )
  assertReportedAmong(
    t,
    messages,
    "The citation states why this declaration answers for that target.",
  )
}

/**
 * Verifies one target cited by one claim and excluded for another owes two reviews.
 *
 * The single-tag design could not express this at all: keyed on the target alone,
 * one review answered both decisions. They are two decisions — this code implements
 * the section, and this other claim does not cover it — so they owe two
 * verifications, and a host may legitimately carry both tags for one target.
 *
 *  1. One host both cites and excludes the same target.
 *  2. Review only the citation.
 *  3. Assert the exclusion is still reported as unreviewed, and the citation is
 *     not.
 */
func TestReviewCountsACitationAndAnExclusionOfOneTargetSeparately(t *testing.T) {
  messages := runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.
 * @evidenceExclude docs/spec.md#pricing A second claim does not cover this section.
 */
export interface ISale {
  price: number;
}
`)
  assertReported(
    t,
    messages,
    "Unreviewed @evidenceExclude for 'docs/spec.md#pricing'",
  )
}

/**
 * Verifies the marker boundary holds for the longer tag too.
 *
 * `@evidenceExcludeReviewed` is one character past the marker and must open
 * nothing, the same property `@evidenceReviewed` already pins. Without it a longer
 * tag from another tool would answer an exclusion nobody reviewed, and the
 * exclusion is the acknowledgement where a false review costs most.
 *
 *  1. Answer an exclusion with `@evidenceExcludeReviewed`.
 *  2. Assert the exclusion is still unreviewed.
 */
func TestReviewJudgesTheBoundaryOfTheExclusionMarker(t *testing.T) {
  assertReported(
    t,
    runReviewRule(t, "src/ISale.ts", `
/**
 * @evidenceExclude docs/spec.md#tax The tax engine owns this, not the sale record.
 * @evidenceExcludeReviewed docs/spec.md#tax Not this rule's tag.
 */
export interface ISale {
  price: number;
}
`),
    "Unreviewed @evidenceExclude for 'docs/spec.md#tax'",
  )
}
