package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph confines exclusions to declared carriers.
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
func TestEvidenceSemanticGraphConfinesExclusionsToDeclaredCarriers(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":   "## Implemented {#implemented}\n\n## Deferred {#deferred}\n",
    "src/LEDGER.ts":  "/**\n * Central exclusions for this package.\n *\n * @evidenceExclude docs/spec.md#deferred This package intentionally implements no operation for the section.\n */\nexport const LEDGER = true;\n",
    "src/service.ts": "/** @evidence docs/spec.md#implemented Implements the section. */\nexport function implement(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"name\":\"operations\",\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"function\",\"evidenceExcludeCarriers\":[\"src/LEDGER.ts\"],\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) != 0 {
    t.Fatalf("unexpected findings: %s", output)
  }
  if strings.Contains(output, "Missing acknowledgement") {
    t.Fatalf("unexpected %q in %s", "Missing acknowledgement", output)
  }
  if strings.Contains(output, "Misplaced @evidenceExclude") {
    t.Fatalf("unexpected %q in %s", "Misplaced @evidenceExclude", output)
  }
}
