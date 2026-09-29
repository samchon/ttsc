package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph keeps claims independent.
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
func TestEvidenceSemanticGraphKeepsClaimsIndependent(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":  "## Alpha {#alpha}\n\n## Beta {#beta}\n",
    "src/team-a.ts": "/** @evidence docs/spec.md#alpha Team A implements Alpha. */\nexport function alpha(): void {}\n",
    "src/team-b.ts": "/** @evidence docs/spec.md#beta Team B implements Beta. */\nexport function beta(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/team-a.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}},{\"type\":\"typescript\",\"files\":[\"src/team-b.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Missing acknowledgement for 'docs/spec.md#beta'") {
    t.Fatalf("missing %q in %s", "Missing acknowledgement for 'docs/spec.md#beta'", output)
  }
  if !strings.Contains(output, "Missing acknowledgement for 'docs/spec.md#alpha'") {
    t.Fatalf("missing %q in %s", "Missing acknowledgement for 'docs/spec.md#alpha'", output)
  }
  if !strings.Contains(output, "Claim 1") {
    t.Fatalf("missing %q in %s", "Claim 1", output)
  }
  if !strings.Contains(output, "Claim 2") {
    t.Fatalf("missing %q in %s", "Claim 2", output)
  }
}
