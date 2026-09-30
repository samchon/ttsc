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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies an exclusion written as prose is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The authored prose exclusion is unreadable at docs/claim/plan.md:5 and must retain its evidenceExclude tag in the diagnostic.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Write an exclusion as an ordinary paragraph line. Evaluate the same claim. Assert the tag is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAMarkdownExclusionWrittenAsProseIsReported is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestAMarkdownExclusionWrittenAsProseIsReported(t *testing.T) {
  assertReported(
    t,
    runProseTagRule(t, "@evidenceExclude docs/spec/rules.md#pricing A decision nothing recorded.\n"),
    "Unreadable @evidenceExclude at docs/claim/plan.md:5",
  )
}
