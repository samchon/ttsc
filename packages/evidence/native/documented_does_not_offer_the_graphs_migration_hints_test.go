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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule over an undocumented `parse` function with the options `{"sources":"src"}`; assertReported requires exactly one diagnostic containing `unknown property; expected only symbol`, and no message may contain `declare 'claims'` or `this relation was inverted`.
 * @evidence contracts/testing.md#independent-expectations The expected wording is authored from the diagnostic contract: `sources` and `citedBy` are graph-only retired properties, so on the documented rule they are plain unknown keys without the graph's migration advice about `reference`.
 * @evidence contracts/testing.md#distinguishing-cases A retired graph property supplied to the documented rule; the same key on the graph rule, which must offer the migration advice, is owned by the graph configuration entries.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedDoesNotOfferTheGraphsMigrationHints is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
