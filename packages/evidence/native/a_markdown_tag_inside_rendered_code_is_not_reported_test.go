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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies an example that renders as code without being a fence is not reported.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations MDX template code and HTML pre render examples rather than declarations; the real comment already covers the obligation, so neither may report a prose tag.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Write a citation inside each rendered-code syntax. Evaluate the same claim. Assert neither is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAMarkdownTagInsideRenderedCodeIsNotReported is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
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
