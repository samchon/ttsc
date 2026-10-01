package evidence

import "testing"

/**
 * Verifies the merge did not become "never report a namespace".
 *
 * Folding merged declarations into
 * one identity must not exempt a namespace that is genuinely undocumented, or
 * the fix would trade a false positive for a silent miss.
 *
 *  1. Leave a standalone namespace undocumented.
 *  2. Run the rule.
 *  3. Assert it is reported.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a standalone `export namespace Orders` with no block (its `version` member is documented); assertReported requires exactly one diagnostic, `Missing JSDoc on exported type 'Orders'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the documented-rule contract: folding merged declarations into one identity must not exempt a namespace that is genuinely undocumented.
 * @evidence contracts/testing.md#distinguishing-cases A namespace with no merge partner and an undocumented founding declaration, the control against a merge fix that would stop reporting namespaces; the documented member does not rescue it.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedStillReportsAnUndocumentedNamespace is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedStillReportsAnUndocumentedNamespace(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Orders.ts", `
export namespace Orders {
  /** Current version. */
  export const version = "1";
}
`, ""), "Missing JSDoc on exported type 'Orders'")
}
