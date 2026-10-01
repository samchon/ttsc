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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies Markdown explanation prose is not constrained by JSDoc tag boundaries. The original assertions check assert the non-empty explanation satisfies coverage.
 * @evidence contracts/testing.md#independent-expectations The expectation of zero diagnostics follows from the grammar contract that an HTML comment has no JSDoc field syntax, so a line starting with an unrelated @architecture belongs to the reason above it; were it treated as a boundary the reason would be empty and a Malformed declaration diagnostic would appear.
 * @evidence contracts/testing.md#distinguishing-cases A single positive case: the target line has no reason of its own and the at-prefixed continuation line must supply it. The JSDoc counterpart where a real tag does stop a reason is not run in this body.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownDeclarationReasonMayBeginWithAtSign is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
