package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies graph reports an unreadable population root.
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
func TestEvidenceSemanticGraphReportsAnUnreadablePopulationRoot(t *testing.T) {
  files := map[string]string{
    "src/sale.ts": "/** @evidence requirements/pricing.md#discounts Discount stacking follows this section. */\nexport interface ISale {}\n",
  }
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  if err := os.MkdirAll(root, 0o755); err != nil {
    t.Fatal(err)
  }
  {
    filename := filepath.Join(workspace, "docs/requirements/pricing.md")
    if err := os.MkdirAll(filepath.Dir(filename), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(filename, []byte("## Discount Policy {#discounts}\n"), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  messages := runIndexRuleAtRoot(t, root, files, "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"root\":\"../documents\",\"files\":[\"requirements/**\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "could not read the markdown root '../documents', which resolves to '") {
    t.Fatalf("missing %q in %s", "could not read the markdown root '../documents', which resolves to '", output)
  }
  if strings.Contains(output, "Unresolved evidence target") {
    t.Fatalf("unexpected %q in %s", "Unresolved evidence target", output)
  }
}
