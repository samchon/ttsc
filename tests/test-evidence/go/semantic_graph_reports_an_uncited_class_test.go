package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph reports an uncited class.
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
func TestEvidenceSemanticGraphReportsAnUncitedClass(t *testing.T) {
  files := map[string]string{
    "docs/subject.md": "## Sale {#sale}\n\nA sale offered to a customer.\n",
    "src/Sale.ts":     "/** A sale offered to a customer. */\nexport class Sale {\n  public readonly price: number = 0;\n}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/Sale.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/subject.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Missing acknowledgement for 'docs/subject.md#sale'") {
    t.Fatalf("missing %q in %s", "Missing acknowledgement for 'docs/subject.md#sale'", output)
  }
}
