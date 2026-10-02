package evidence

import (
  "testing"
)

/**
 * Verifies the counting rule sees separate bindings of one statement.
 *
 * A single `export const a = 1, b = 2;` declares two identities behind one
 * statement node, so a walker that stopped at the statement would miss the
 * second.
 *
 *  1. Export two bindings from one variable statement.
 *  2. Run the rule.
 *  3. Assert both are named.
 *
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert both are named.
 * @evidence contracts/testing.md#independent-expectations A single `export const a = 1, b = 2;` declares two identities behind one statement node, so a walker that stopped at the statement would miss the second. The authored scenario requires this outcome: Assert both are named.
 * @evidence contracts/testing.md#distinguishing-cases Export two bindings from one variable statement. Run the rule. Assert both are named.
 * @evidence contracts/testing.md#execution-ownership TestSingularReportsSeparateBindingsOfOneStatement runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularReportsSeparateBindingsOfOneStatement(t *testing.T) {
  messages := runSingularRule(t, "src/pair.ts", `
export const first = 1, second = 2;
`)
  assertReported(t, messages, "'first' (line 2), 'second' (line 2)")
}
