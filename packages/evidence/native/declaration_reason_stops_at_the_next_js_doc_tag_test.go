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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies JSDoc grammar boundaries: a later JSDoc tag cannot become the missing reason of an evidence declaration. The original assertions check assert the declaration remains malformed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Reasons may wrap across prose lines, but `@returns`, `@example`, and other tags begin new JSDoc fields. Treating one as prose would accept a declaration whose mandatory explanation is still absent. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Write an `@evidence` target without a reason. Follow it with an unrelated JSDoc tag. Assert the declaration remains malformed. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDeclarationReasonStopsAtTheNextJSDocTag is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
