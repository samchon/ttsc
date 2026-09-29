package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph reports non participating exclusion.
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
func TestEvidenceSemanticGraphReportsNonParticipatingExclusion(t *testing.T) {
  files := map[string]string{
    "docs/first.md":  "## First\n",
    "docs/second.md": "## Second\n",
    "src/first.ts":   "/** @evidenceExclude docs/second.md#second This exclusion belongs to no reference of this claim. */\nexport interface First {}\n",
    "src/second.ts":  "/** @evidence docs/second.md#second This claim owns the target. */\nexport interface Second {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"name\":\"first\",\"type\":\"typescript\",\"files\":[\"src/first.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/first.md\"],\"symbol\":\"h2\"}},{\"name\":\"second\",\"type\":\"typescript\",\"files\":[\"src/second.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/second.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Non-participating @evidenceExclude target 'docs/second.md#second'") {
    t.Fatalf("missing %q in %s", "Non-participating @evidenceExclude target 'docs/second.md#second'", output)
  }
  if !strings.Contains(output, "Claim 1 ('first') across reference 1") {
    t.Fatalf("missing %q in %s", "Claim 1 ('first') across reference 1", output)
  }
}
