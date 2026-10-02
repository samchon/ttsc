package evidence

import "testing"

/**
 * Verifies an empty file is silent.
 *
 * The zero case: no statements means no host, and a walker assuming at least
 * one would fault on the emptiest input a project can contain.
 *
 *  1. Parse a file with no statements.
 *  2. Run the rule.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over an empty source file; assertSilent requires no diagnostics and the call must not panic.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the contract that no statements means no host: an empty file has nothing that could be missing a block.
 * @evidence contracts/testing.md#distinguishing-cases The zero-statement boundary only; a walker that assumed at least one statement would fault here. Files with exports are owned by the other documented entries.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsEmptyFiles is a Go unit entry in the native test process; runDocumentedRule parses an empty string with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedAcceptsEmptyFiles(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/blank.ts", "", ""))
}
