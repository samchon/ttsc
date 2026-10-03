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
 * @evidence contracts/testing.md#behavioral-verification runProseTagRule runs graphRule.Check over a plan document in four t.Run subtests that place a tag line inside a backtick fence, a tilde fence, a four-space indented block, and a sentence that mentions `@evidence` mid-line; each asserts an empty diagnostic list.
 * @evidence contracts/testing.md#independent-expectations Silence is required by the Markdown contract that fenced and indented code and mid-sentence mentions are examples, not declarations; the helper's valid HTML-comment citation already discharges the obligation, so any diagnostic can only come from the example text.
 * @evidence contracts/testing.md#distinguishing-cases Four negative cases for the prose-tag reporter (two fence spellings, indented code, mid-line mention); the positive prose cases that must be reported are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestAMarkdownTagInsideAnExampleIsNotReported is a Go unit entry in the native test process that owns four t.Run subtests over a map of fixtures; runProseTagRule writes the Markdown to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
