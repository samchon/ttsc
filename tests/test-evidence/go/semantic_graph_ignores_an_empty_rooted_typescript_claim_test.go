package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies graph ignores an empty rooted typescript claim.
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
func TestEvidenceSemanticGraphIgnoresAnEmptyRootedTypescriptClaim(t *testing.T) {
  files := map[string]string{
    "docs/spec.md": "## Alpha\n",
    "src/sale.ts":  "export interface ISale {}\n",
  }
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  if err := os.MkdirAll(root, 0o755); err != nil {
    t.Fatal(err)
  }
  {
    filename := filepath.Join(workspace, "shared/.keep")
    if err := os.MkdirAll(filepath.Dir(filename), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(filename, []byte(""), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  messages := runIndexRuleAtRoot(t, root, files, "{\"claims\":[{\"type\":\"typescript\",\"root\":\"../shared\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/**\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) != 0 {
    t.Fatalf("unexpected findings: %s", output)
  }
  if strings.Contains(output, "found no directory at the typescript root") {
    t.Fatalf("unexpected %q in %s", "found no directory at the typescript root", output)
  }
  if strings.Contains(output, "Missing acknowledgement") {
    t.Fatalf("unexpected %q in %s", "Missing acknowledgement", output)
  }
}
