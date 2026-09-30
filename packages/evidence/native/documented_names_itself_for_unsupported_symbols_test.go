package evidence

import "testing"

/**
 * Verifies an unsupported symbol value also names the owning rule.
 *
 * The symbol decoder is the second shared entry point, and it reports through a
 * different branch than the unknown-key check above. Fixing one and leaving the
 * other would misattribute exactly the configuration a reader is most likely to
 * get wrong, since the Markdown vocabulary decodes cleanly as a string.
 *
 *  1. Configure a Markdown symbol on a TypeScript rule.
 *  2. Run the rule.
 *  3. Assert the message names `evidence/documented`.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies an unsupported symbol value also names the owning rule. The original assertions check assert the message names `evidence/documented`.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The symbol decoder is the second shared entry point, and it reports through a different branch than the unknown-key check above. Fixing one and leaving the other would misattribute exactly the configuration a reader is most likely to get wrong, since the Markdown vocabulary decodes cleanly as a string. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure a Markdown symbol on a TypeScript rule. Run the rule. Assert the message names `evidence/documented`. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedNamesItselfForUnsupportedSymbols is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedNamesItselfForUnsupportedSymbols(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, `{"symbol":"h2"}`)
  assertReported(t, messages, "Invalid evidence/documented configuration")
  assertReported(t, messages, "symbol 'h2' is not supported")
}
