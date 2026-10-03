package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a configuration diagnostic names the rule whose setting is wrong.
 *
 * `evidence/documented` decodes its options through the helpers `evidence/graph`
 * uses, and those helpers opened every message with the graph's name. A reader
 * with both rules enabled was sent to edit a graph configuration that is not
 * wrong, while the setting that is stays as they left it.
 *
 *  1. Configure `evidence/documented` with a misspelled option key.
 *  2. Run the rule.
 *  3. Assert the message names `evidence/documented` and never the graph.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule over an exported `parse` function with the misspelled option key `{"symbols":"type"}`; assertReported requires exactly one diagnostic containing `Invalid evidence/documented configuration`, and no message may contain the graph rule's name.
 * @evidence contracts/testing.md#independent-expectations The expected wording is authored from the diagnostic contract: a setting error on the documented rule must name `evidence/documented`, not the graph rule whose option helpers it shares.
 * @evidence contracts/testing.md#distinguishing-cases One misspelled option key; the unsupported-symbol branch is owned by the sibling entry. The graph-name check loops over the messages to cover every reported line.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedNamesItselfInConfigurationDiagnostics is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedNamesItselfInConfigurationDiagnostics(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, `{"symbols":"type"}`)
  assertReported(t, messages, "Invalid evidence/documented configuration")
  for _, message := range messages {
    if strings.Contains(message, graphRuleName) {
      t.Fatalf("a documented diagnostic named the graph:\n%s", message)
    }
  }
}
