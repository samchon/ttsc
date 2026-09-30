package evidence

import (
  "testing"
)

/**
 * Verifies a review written as prose is reported under the tag it was written
 * as.
 *
 * A review that reaches nothing can never expire and never satisfy anything,
 * which is the one outcome `requireReview` exists to make impossible. The two
 * review tags answer different questions, so the diagnostic has to name the one
 * the author actually wrote.
 *
 *  1. Write a review of an exclusion as an ordinary paragraph line.
 *  2. Evaluate the same claim.
 *  3. Assert it is reported as `@evidenceExcludeReview`.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies a review written as prose is reported under the tag it was written as.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The prose exclusion review must report evidenceExcludeReview at line 5, rather than silently discarding or renaming the tag.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Write a review of an exclusion as an ordinary paragraph line. Evaluate the same claim. Assert it is reported as `@evidenceExcludeReview`.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAMarkdownReviewWrittenAsProseIsReported is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestAMarkdownReviewWrittenAsProseIsReported(t *testing.T) {
  assertReported(
    t,
    runProseTagRule(t, "@evidenceExcludeReview docs/spec/rules.md#pricing Read and agreed.\n"),
    "Unreadable @evidenceExcludeReview at docs/claim/plan.md:5",
  )
}
