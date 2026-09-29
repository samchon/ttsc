package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph reports an unselected exclusion carrier.
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
func TestEvidenceSemanticGraphReportsAnUnselectedExclusionCarrier(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":   "## Implemented {#implemented}\n",
    "src/service.ts": "/** @evidence docs/spec.md#implemented Implements the section. */\nexport function implement(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"name\":\"operations\",\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"evidenceExcludeCarriers\":[\"vendor/LEDGER.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "evidenceExcludeCarriers") {
    t.Fatalf("missing %q in %s", "evidenceExcludeCarriers", output)
  }
  if !strings.Contains(output, "'vendor/LEDGER.ts'") {
    t.Fatalf("missing %q in %s", "'vendor/LEDGER.ts'", output)
  }
}
