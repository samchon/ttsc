package evidence

import (
  "testing"
)

/**
 * Verifies an exclusion written as prose is reported.
 *
 * The exclusion is the worse of the two to lose. Its reason field makes it read
 * as a reviewed decision to leave something uncovered, so an author who writes
 * one and hears nothing believes a judgement was recorded when none was.
 *
 *  1. Write an exclusion as an ordinary paragraph line.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runProseTagRule runs graphRule.Check over docs/claim/plan.md ending in the paragraph line `@evidenceExclude docs/spec/rules.md#pricing ...`; assertReported requires exactly one diagnostic `Unreadable @evidenceExclude at docs/claim/plan.md:5`.
 * @evidence contracts/testing.md#independent-expectations The expected tag name and line 5 are literals read off the authored fixture layout; the valid HTML-comment citation in the helper discharges the obligation, so only the unreadable report can remain.
 * @evidence contracts/testing.md#distinguishing-cases This entry owns the exclusion tag only, and the exactly-one assertion shows the diagnostic names @evidenceExclude rather than @evidence; the citation and review tags are covered by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestAMarkdownExclusionWrittenAsProseIsReported is a Go unit entry in the native test process; runProseTagRule writes the Markdown fixture to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestAMarkdownExclusionWrittenAsProseIsReported(t *testing.T) {
  assertReported(
    t,
    runProseTagRule(t, "@evidenceExclude docs/spec/rules.md#pricing A decision nothing recorded.\n"),
    "Unreadable @evidenceExclude at docs/claim/plan.md:5",
  )
}
