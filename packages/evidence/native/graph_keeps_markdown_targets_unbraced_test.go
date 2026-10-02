package evidence

import "testing"

/**
 * Verifies a Markdown path target is untouched by the migration branch.
 *
 * The negative twin that keeps the migration diagnostic from swallowing every
 * unbraced target in the repository. A Markdown address never becomes an inline
 * link, so it must never be told to.
 *
 *  1. Cite a Markdown heading from a TypeScript claim, unbraced.
 *  2. Evaluate the graph.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a Markdown reference over docs/spec.md, where the function cites the unbraced `docs/spec.md#pricing`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the grammar contract: a Markdown address is never an inline link, so the migration diagnostic for unbraced code targets must not fire on it.
 * @evidence contracts/testing.md#distinguishing-cases The negative twin of the unbraced-TypeScript-target migration entry: same unbraced shape, but the target is a Markdown path and resolves and acknowledges the heading.
 * @evidence contracts/testing.md#execution-ownership TestGraphKeepsMarkdownTargetsUnbraced is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphKeepsMarkdownTargetsUnbraced(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/views/detail.ts": `
/** @evidence docs/spec.md#pricing Renders the documented price. */
export function detail(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`))
}
