package evidence

import "testing"

/**
 * Verifies the negative twin: a documented export is silent.
 *
 * Without it TestDocumentedReportsUndocumentedExport is equally satisfied by a rule that reports every
 * declaration it sees.
 *
 *  1. Export the same function with a JSDoc block.
 *  2. Run the rule with the default selection.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the negative twin: a documented export is silent. The original assertions check assert silence.
 * @evidence contracts/testing.md#independent-expectations Without it TestDocumentedReportsUndocumentedExport is equally satisfied by a rule that reports every declaration it sees. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Export the same function with a JSDoc block. Run the rule with the default selection. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsDocumentedExport is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedAcceptsDocumentedExport(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/parse.ts", `
/** Normalizes a raw input value. */
export function parse(value: string): string {
  return value;
}
`, ""))
}
