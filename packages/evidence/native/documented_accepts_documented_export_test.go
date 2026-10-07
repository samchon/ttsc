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
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over `export function parse` preceded by a content JSDoc block; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: an export that carries a JSDoc block with content is satisfied, so the rule must not report it.
 * @evidence contracts/testing.md#distinguishing-cases This is the accepting twin of the undocumented-export report entry: without it, a rule that reported every declaration would still pass that entry. It covers one documented function only.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsDocumentedExport is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedAcceptsDocumentedExport(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/parse.ts", `
/** Normalizes a raw input value. */
export function parse(value: string): string {
  return value;
}
`, ""))
}
