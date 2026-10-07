package evidence

import (
  "testing"
)

/**
 * Verifies a citation carried by a list or a quote is reported.
 *
 * A bullet is how a reader most naturally writes a citation into a plan, and a
 * quote is how they paste one from elsewhere. Both were silent, because the tag
 * has to be the first content on its line and a marker was counted as content,
 * so the shape this rule exists for went on reproducing itself in the two
 * spellings an author is most likely to reach for.
 *
 * The mid-sentence row is the negative twin the marker rule must not break: a
 * line has to open with the tag once its markers come off, or a sentence that
 * mentions one would be reported as a declaration.
 *
 *  1. Write a citation behind each marker, and one mid-sentence.
 *  2. Evaluate the same claim.
 *  3. Assert the carried ones are reported and the sentence is not.
 *
 * @evidence contracts/testing.md#behavioral-verification runProseTagRule runs graphRule.Check over docs/claim/plan.md, which carries one valid HTML-comment citation and then a prose line; the subtests put `@evidence` behind a bullet, asterisk, ordered, quote and quoted-bullet marker and each requires exactly one diagnostic `Unreadable @evidence at docs/claim/plan.md:5`, and a sentence that mentions the tag mid-line must produce none.
 * @evidence contracts/testing.md#independent-expectations Line 5 follows from the authored plan layout (heading, blank, citation comment, blank, prose line) and the real comment citation already discharges the obligation, so the single expected diagnostic is the unreadable-tag report; the expectation is a literal, not computed.
 * @evidence contracts/testing.md#distinguishing-cases Five marker spellings are the positive cases; a line where the tag is not the first content after markers is the negative case that must stay silent. Exclusion and review tags are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestAMarkdownCitationBehindAMarkerIsReported is a Go unit entry in the native test process that owns five t.Run subtests over a map of marker forms; runProseTagRule writes the Markdown fixture to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestAMarkdownCitationBehindAMarkerIsReported(t *testing.T) {
  for name, plan := range map[string]string{
    "bullet":        "- @evidence docs/spec/rules.md#pricing The bullet form.\n",
    "asterisk":      "* @evidence docs/spec/rules.md#pricing The asterisk form.\n",
    "ordered":       "1. @evidence docs/spec/rules.md#pricing The ordered form.\n",
    "quote":         "> @evidence docs/spec/rules.md#pricing The quoted form.\n",
    "quoted bullet": "> - @evidence docs/spec/rules.md#pricing Both markers.\n",
  } {
    t.Run(name, func(t *testing.T) {
      assertReported(t, runProseTagRule(t, plan), "Unreadable @evidence at docs/claim/plan.md:5")
    })
  }
  assertNoProblems(t, runProseTagRule(t, "The tag @evidence names a target and a reason.\n"))
}
