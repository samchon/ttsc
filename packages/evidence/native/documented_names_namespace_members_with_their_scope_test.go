package evidence

import "testing"

/**
 * Verifies a namespace member is named with its namespace.
 *
 * Same reasoning one scope deeper: `Orders.version` is the target a citation
 * would have to name.
 *
 *  1. Leave a namespace member undocumented.
 *  2. Run the rule.
 *  3. Assert the qualified name is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `namespace Orders` containing an undocumented `export const version`; assertReported requires exactly one diagnostic containing `exported property 'Orders.version'`.
 * @evidence contracts/testing.md#independent-expectations The expected name is authored from the addressing contract: the target a citation would have to name is the qualified `Orders.version`, so the diagnostic must carry the namespace.
 * @evidence contracts/testing.md#distinguishing-cases One namespace member with a documented namespace; the owner-qualified interface properties and the bare top-level names are covered by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedNamesNamespaceMembersWithTheirScope is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedNamesNamespaceMembersWithTheirScope(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Orders.ts", `
/** Order contracts. */
export namespace Orders {
  export const version = "1";
}
`, ""), "exported property 'Orders.version'")
}
