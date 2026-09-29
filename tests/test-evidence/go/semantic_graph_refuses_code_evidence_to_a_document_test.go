package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph refuses code evidence to a document.
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
func TestEvidenceSemanticGraphRefusesCodeEvidenceToADocument(t *testing.T) {
  files := map[string]string{
    "src/sale.ts":  "export interface ISale {}\n",
    "docs/spec.md": "<!-- @evidence ISale This document relies on the sale contract. -->\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"type\":\"markdown\",\"files\":[\"docs/**/*.md\"],\"symbol\":\"file\",\"reference\":{\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"]}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "unqualified symbol has no module identity") {
    t.Fatalf("missing %q in %s", "unqualified symbol has no module identity", output)
  }
  if !strings.Contains(output, "@link") {
    t.Fatalf("missing %q in %s", "@link", output)
  }
}
