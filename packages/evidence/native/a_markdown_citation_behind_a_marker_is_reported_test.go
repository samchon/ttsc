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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies a citation carried by a list or a quote is reported.
 *
 * @evidence contracts/testing.md#independent-expectations Each bullet/ordered/quote marker leaves a line-opening citation at line 5, while the authored mid-sentence mention must remain silent.
 *
 * @evidence contracts/testing.md#distinguishing-cases Write a citation behind each marker, and one mid-sentence. Evaluate the same claim. Assert the carried ones are reported and the sentence is not.
 *
 * @evidence contracts/testing.md#execution-ownership TestAMarkdownCitationBehindAMarkerIsReported is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
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
