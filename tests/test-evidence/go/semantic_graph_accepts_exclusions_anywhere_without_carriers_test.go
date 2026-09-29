package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph accepts exclusions anywhere without carriers.
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
func TestEvidenceSemanticGraphAcceptsExclusionsAnywhereWithoutCarriers(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":   "## Implemented {#implemented}\n\n## Deferred {#deferred}\n",
    "src/LEDGER.ts":  "/** Central exclusions for this package. */\nexport const LEDGER = true;\n",
    "src/service.ts": "/** @evidence docs/spec.md#implemented Implements the section. */\nexport function implement(): void {}\n\n/** @evidenceExclude docs/spec.md#deferred No carrier is declared, so any host may hold this. */\nexport function deferOperation(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"name\":\"operations\",\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) != 0 {
    t.Fatalf("unexpected findings: %s", output)
  }
  if strings.Contains(output, "Misplaced @evidenceExclude") {
    t.Fatalf("unexpected %q in %s", "Misplaced @evidenceExclude", output)
  }
  if strings.Contains(output, "Missing acknowledgement") {
    t.Fatalf("unexpected %q in %s", "Missing acknowledgement", output)
  }
}
