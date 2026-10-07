package evidence

import (
  "testing"
)

/**
 * Verifies an example that renders as code without being a fence is not
 * reported.
 *
 * A documentation site shows examples through more than one syntax: an MDX page
 * passes a template literal to a component and an HTML page uses `<pre>`. Both
 * render as code, so both are examples in the sense a fence is, and the repair
 * this diagnostic names would delete the example from the rendered page instead
 * of fixing anything. This repository's own pages use fences, so the exposure
 * is a consumer's docs site and the cost is their build.
 *
 *  1. Write a citation inside each rendered-code syntax.
 *  2. Evaluate the same claim.
 *  3. Assert neither is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runProseTagRule runs graphRule.Check over a plan document in two t.Run subtests, one with a tag line inside an MDX `<Code ... code={`...`} />` template literal and one inside an HTML `<pre>` block; each asserts an empty diagnostic list.
 * @evidence contracts/testing.md#independent-expectations Silence is required because both constructs render as code examples, so reporting would tell the author to delete rendered documentation; the helper's valid comment citation discharges the obligation, so any diagnostic could only come from the example.
 * @evidence contracts/testing.md#distinguishing-cases Two negative cases for rendered-code syntaxes that are not fences; fences, indented code and positive prose reports are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestAMarkdownTagInsideRenderedCodeIsNotReported is a Go unit entry in the native test process that owns two t.Run subtests; runProseTagRule writes the Markdown to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestAMarkdownTagInsideRenderedCodeIsNotReported(t *testing.T) {
  for name, plan := range map[string]string{
    "mdx component": "<Code lang=\"md\" code={`\n@evidence docs/spec/rules.md#pricing Example.\n`} />\n",
    "html pre":      "<pre>\n@evidence docs/spec/rules.md#pricing Example.\n</pre>\n",
  } {
    t.Run(name, func(t *testing.T) {
      assertNoProblems(t, runProseTagRule(t, plan))
    })
  }
}
