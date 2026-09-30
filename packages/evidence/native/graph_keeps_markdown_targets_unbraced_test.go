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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a Markdown path target is untouched by the migration branch. The original assertions check assert silence.
 * @evidence contracts/testing.md#independent-expectations The negative twin that keeps the migration diagnostic from swallowing every unbraced target in the repository. A Markdown address never becomes an inline link, so it must never be told to. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Cite a Markdown heading from a TypeScript claim, unbraced. Evaluate the graph. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphKeepsMarkdownTargetsUnbraced is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
