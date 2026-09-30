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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a configuration diagnostic names the rule whose setting is wrong. The original assertions check assert the message names `evidence/documented` and never the graph.
 * @evidence contracts/testing.md#independent-expectations `evidence/documented` decodes its options through the helpers `evidence/graph` uses, and those helpers opened every message with the graph's name. A reader with both rules enabled was sent to edit a graph configuration that is not wrong, while the setting that is stays as they left it. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Configure `evidence/documented` with a misspelled option key. Run the rule. Assert the message names `evidence/documented` and never the graph. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedNamesItselfInConfigurationDiagnostics is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
