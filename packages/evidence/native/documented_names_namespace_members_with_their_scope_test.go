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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a namespace member is named with its namespace. The original assertions check assert the qualified name is reported.
 * @evidence contracts/testing.md#independent-expectations Same reasoning one scope deeper: `Orders.version` is the target a citation would have to name. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Leave a namespace member undocumented. Run the rule. Assert the qualified name is reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedNamesNamespaceMembersWithTheirScope is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedNamesNamespaceMembersWithTheirScope(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Orders.ts", `
/** Order contracts. */
export namespace Orders {
  export const version = "1";
}
`, ""), "exported property 'Orders.version'")
}
