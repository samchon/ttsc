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
 * An absent selected base differs from an available sibling containing pricing.md; the root cause must suppress target-resolution noise.
 *
 * 1. graphRule.Check reports the absent ../documents Markdown root without an unresolved-target derivative; ../docs resolves the same citation silently.
 * 2. The fixture deliberately creates ../docs and not ../documents; the explicit loader message and silent readable sibling are independent failure/recovery expectations.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check reports the absent ../documents Markdown root without an unresolved-target derivative; ../docs resolves the same citation silently.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately creates ../docs and not ../documents; the explicit loader message and silent readable sibling are independent failure/recovery expectations.
 * @evidence contracts/testing.md#distinguishing-cases An absent selected base differs from an available sibling containing pricing.md; the root cause must suppress target-resolution noise.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphReportsAnUnreadablePopulationRoot owns these assertions. runIndexRuleAtRoot invokes graphRule.Check on temporary project/documents with the original failing root and corrected readable-root option.
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
  // The independently created ../docs population is the readable sibling; the
  // earlier ../documents spelling must remain a loader failure.
  repaired := runIndexRuleAtRoot(t, root, files, strings.Replace("{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"root\":\"../documents\",\"files\":[\"requirements/**\"],\"symbol\":\"h2\"}}]}", "../documents", "../docs", 1))
  if len(repaired) != 0 {
    t.Fatalf("the readable sibling root and original citation must be silent: %s", strings.Join(repaired, "\n"))
  }

}
