package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph reports an exclusion outside its carrier.
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
func TestEvidenceSemanticGraphReportsAnExclusionOutsideItsCarrier(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":   "## Implemented {#implemented}\n\n## Deferred {#deferred}\n",
    "src/LEDGER.ts":  "/** Central exclusions for this package. */\nexport const LEDGER = true;\n",
    "src/service.ts": "/** @evidence docs/spec.md#implemented Implements the section. */\nexport function implement(): void {}\n\n/** @evidenceExclude docs/spec.md#deferred This working host is not a declared carrier. */\nexport function deferOperation(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"name\":\"operations\",\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"function\",\"evidenceExcludeCarriers\":[\"src/LEDGER.ts\"],\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Misplaced @evidenceExclude") {
    t.Fatalf("missing %q in %s", "Misplaced @evidenceExclude", output)
  }
  if !strings.Contains(output, "evidenceExcludeCarriers") {
    t.Fatalf("missing %q in %s", "evidenceExcludeCarriers", output)
  }
  if !strings.Contains(output, "'src/LEDGER.ts'") {
    t.Fatalf("missing %q in %s", "'src/LEDGER.ts'", output)
  }
  if !strings.Contains(output, "Missing acknowledgement for 'docs/spec.md#deferred'") {
    t.Fatalf("missing %q in %s", "Missing acknowledgement for 'docs/spec.md#deferred'", output)
  }
}
