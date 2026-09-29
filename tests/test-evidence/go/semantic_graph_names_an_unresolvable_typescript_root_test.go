package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies graph names an unresolvable typescript root.
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
func TestEvidenceSemanticGraphNamesAnUnresolvableTypescriptRoot(t *testing.T) {
  files := map[string]string{
    "docs/spec.md": "## Alpha\n",
    "src/sale.ts":  "export interface ISale {}\n",
  }
  root := filepath.Join(t.TempDir(), "project")
  if err := os.MkdirAll(root, 0o755); err != nil {
    t.Fatal(err)
  }
  messages := runIndexRuleAtRoot(t, root, files, "{\"claims\":[{\"type\":\"typescript\",\"root\":\"../absent\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/**\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "found no directory at the typescript root '../absent'") {
    t.Fatalf("missing %q in %s", "found no directory at the typescript root '../absent'", output)
  }
  if strings.Contains(output, "'*' stays within one segment") {
    t.Fatalf("unexpected %q in %s", "'*' stays within one segment", output)
  }
}
