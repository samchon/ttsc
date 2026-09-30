package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the graph's migration hints stay on the graph.
 *
 * `sources` and `citedBy` are properties only the graph ever had. Offering their
 * migration advice to another rule would tell a reader to move a setting into
 * `reference`, on a rule that has no references at all.
 *
 *  1. Configure `evidence/documented` with the retired graph property names.
 *  2. Run the rule.
 *  3. Assert they are reported as plain unknown keys, with no migration advice.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the graph's migration hints stay on the graph. The original assertions check assert they are reported as plain unknown keys, with no migration advice.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `sources` and `citedBy` are properties only the graph ever had. Offering their migration advice to another rule would tell a reader to move a setting into `reference`, on a rule that has no references at all. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure `evidence/documented` with the retired graph property names. Run the rule. Assert they are reported as plain unknown keys, with no migration advice. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedDoesNotOfferTheGraphsMigrationHints is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedDoesNotOfferTheGraphsMigrationHints(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, `{"sources":"src"}`)
  assertReported(t, messages, "unknown property; expected only symbol")
  for _, message := range messages {
    if strings.Contains(message, "declare 'claims'") ||
      strings.Contains(message, "this relation was inverted") {
      t.Fatalf("a documented diagnostic offered a graph migration:\n%s", message)
    }
  }
}
