package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph derives no host finding from an empty population.
 *
 * A present document containing prose differs from an unreadable root; its empty denominator must not manufacture a per-host cardinality obligation.
 *
 * 1. graphRule.Check reports that the Markdown h2 population is empty without deriving a singleEvidencePerSymbol finding on sell.
 * 2. The heading-free literal document has zero selected h2 units, so the named population failure is valid while the exactly-one host cardinality message is forbidden.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check reports that the Markdown h2 population is empty without deriving a singleEvidencePerSymbol finding on sell.
 * @evidence contracts/testing.md#independent-expectations The heading-free literal document has zero selected h2 units, so the named population failure is valid while the exactly-one host cardinality message is forbidden.
 * @evidence contracts/testing.md#distinguishing-cases A present document containing prose differs from an unreadable root; its empty denominator must not manufacture a per-host cardinality obligation.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphDerivesNoHostFindingFromAnEmptyPopulation owns these assertions. runIndexRule parses sell and loads the real temporary prose document, then calls graphRule.Check with singleEvidencePerSymbol enabled.
 */
func TestEvidenceSemanticGraphDerivesNoHostFindingFromAnEmptyPopulation(t *testing.T) {
  files := map[string]string{
    "docs/spec.md": "Prose with no heading the selector accepts.\n",
    "src/sale.ts":  "export function sell(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/**\"],\"symbol\":\"h2\",\"singleEvidencePerSymbol\":true}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "found no selected evidence units") {
    t.Fatalf("missing %q in %s", "found no selected evidence units", output)
  }
  if strings.Contains(output, "singleEvidencePerSymbol requires exactly 1") {
    t.Fatalf("unexpected %q in %s", "singleEvidencePerSymbol requires exactly 1", output)
  }
}
