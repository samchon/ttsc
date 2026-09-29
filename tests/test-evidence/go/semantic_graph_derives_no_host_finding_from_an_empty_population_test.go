package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph derives no host finding from an empty population.
 *
 * The unchanged consumer inputs now exercise the production parser, graph
 * rule, population loading and resolver together without spawning a compiler.
 * Package wiring, typed options, severity and watches remain batched consumer
 * contracts. Every original positive and negative diagnostic is retained here.
 *
 * 1. Materialize the original source and document population.
 * 2. Call the actual project rule with the same JSON options.
 * 3. Check the original findings and silent boundaries.
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
