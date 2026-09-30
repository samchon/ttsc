package evidence

import (
  "testing"
)

/**
 * Verifies an example is not reported.
 *
 * This is the population the repair must leave silent, and it is not a
 * concession: this product's own documentation shows tags inside fences, so
 * reporting them would fail its build. Both fence spellings and the indented
 * form are the same case, and a sentence that merely mentions a tag is a fourth,
 * because a declaration has to open its line.
 *
 *  1. Write a tag inside each of the three code forms and inside a sentence.
 *  2. Evaluate the same claim.
 *  3. Assert nothing is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies an example is not reported.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Backtick/tilde/indented examples and a mid-sentence mention are not declarations; the fixture real comment supplies coverage, so these inputs must stay silent.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Write a tag inside each of the three code forms and inside a sentence. Evaluate the same claim. Assert nothing is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAMarkdownTagInsideAnExampleIsNotReported is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestAMarkdownTagInsideAnExampleIsNotReported(t *testing.T) {
  for name, plan := range map[string]string{
    "backtick fence": "```md\n@evidence docs/spec/rules.md#pricing Inside a fence.\n```\n",
    "tilde fence":    "~~~\n@evidence docs/spec/rules.md#pricing Inside a fence.\n~~~\n",
    "indented block": "    @evidence docs/spec/rules.md#pricing Indented as code.\n",
    "mid-sentence":   "The tag @evidence names a target and a reason.\n",
  } {
    t.Run(name, func(t *testing.T) {
      assertNoProblems(t, runProseTagRule(t, plan))
    })
  }
}
