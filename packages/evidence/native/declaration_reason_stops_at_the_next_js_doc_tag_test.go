package evidence

import "testing"

/**
 * Verifies JSDoc grammar boundaries: a later JSDoc tag cannot become the
 * missing reason of an evidence declaration.
 *
 * Reasons may wrap across prose lines, but `@returns`, `@example`, and other
 * tags begin new JSDoc fields. Treating one as prose would accept a declaration
 * whose mandatory explanation is still absent.
 *
 *  1. Write an `@evidence` target without a reason.
 *  2. Follow it with an unrelated JSDoc tag.
 *  3. Assert the declaration remains malformed.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over a function whose block holds `@evidence docs/spec.md#contract` with no reason followed by `@returns Nothing.`, under a function claim and a Markdown reference over docs/spec.md; assertProblemContains requires `Malformed @evidence declaration` and `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expected diagnostics are authored from the grammar contract: a reason may wrap across prose lines but a following JSDoc tag begins a new field, so the declaration stays without its mandatory reason and the section remains unacknowledged.
 * @evidence contracts/testing.md#distinguishing-cases A reason-less declaration followed by an unrelated JSDoc tag; the two assertions are independent (malformed report and uncovered section) and only containment is asserted. A reason that legitimately wraps is owned by other entries.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationReasonStopsAtTheNextJSDocTag is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestDeclarationReasonStopsAtTheNextJSDocTag(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/**
 * @evidence docs/spec.md#contract
 * @returns Nothing.
 */
export function ref(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Malformed @evidence declaration")
  assertProblemContains(t, messages, "Missing acknowledgement")
}
