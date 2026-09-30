package evidence

import "testing"

/**
 * Verifies Markdown explanation prose is not constrained by JSDoc tag
 * boundaries.
 *
 * A line beginning with `@` starts a new field in JSDoc, but an HTML comment
 * has no such grammar. The same parser handles both hosts, so it must preserve
 * an at-prefixed Markdown reason while still stopping at real JSDoc tags.
 *
 *  1. Put a Markdown declaration target on one line.
 *  2. Begin its explanation with an at-prefixed approval marker on the next.
 *  3. Assert the non-empty explanation satisfies coverage.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies Markdown explanation prose is not constrained by JSDoc tag boundaries. The original assertions check assert the non-empty explanation satisfies coverage.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A line beginning with `@` starts a new field in JSDoc, but an HTML comment has no such grammar. The same parser handles both hosts, so it must preserve an at-prefixed Markdown reason while still stopping at real JSDoc tags. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Put a Markdown declaration target on one line. Begin its explanation with an at-prefixed approval marker on the next. Assert the non-empty explanation satisfies coverage. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMarkdownDeclarationReasonMayBeginWithAtSign is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestMarkdownDeclarationReasonMayBeginWithAtSign(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "docs/ref.md": `<!--
@evidence docs/spec.md#contract
@architecture approved this adoption.
-->
`,
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/ref.md"],
    "symbol":"file",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
