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
 * An empty root and a disk-only Ready remain inactive; adding Ready to the Program source map activates the claim. The original project ISale stays outside that root.
 *
 * 1. graphRule.Check leaves empty and disk-only rooted TypeScript claims inactive, then reports missing Alpha when uncited Ready enters ctx.Sources.
 * 2. The literal docs/spec.md#alpha obligation applies only after the independently authored Ready declaration is included in the selected Program sources.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check leaves empty and disk-only rooted TypeScript claims inactive, then reports missing Alpha when uncited Ready enters ctx.Sources.
 * @evidence contracts/testing.md#independent-expectations The literal docs/spec.md#alpha obligation applies only after the independently authored Ready declaration is included in the selected Program sources.
 * @evidence contracts/testing.md#distinguishing-cases An empty root and a disk-only Ready remain inactive; adding Ready to the Program source map activates the claim. The original project ISale stays outside that root.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphIgnoresAnEmptyRootedTypescriptClaim owns these assertions. runIndexRuleAtRoot parses the supplied source map into ctx.Sources and invokes graphRule.Check; this case distinguishes a disk-only declaration from its in-process Program inclusion.
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
  sharedSource := filepath.Join(workspace, "shared", "src", "Ready.ts")
  if err := os.MkdirAll(filepath.Dir(sharedSource), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(sharedSource, []byte("export interface Ready {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  diskOnly := runIndexRuleAtRoot(t, root, files, "{\"claims\":[{\"type\":\"typescript\",\"root\":\"../shared\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/**\"],\"symbol\":\"h2\"}}]}")
  if len(diskOnly) != 0 {
    t.Fatalf("disk-only declarations must not populate TypeScript claims: %s", strings.Join(diskOnly, "\n"))
  }
  populatedFiles := make(map[string]string, len(files)+1)
  for filename, content := range files {
    populatedFiles[filename] = content
  }
  populatedFiles["../shared/src/Ready.ts"] = "export interface Ready {}\n"
  populated := strings.Join(runIndexRuleAtRoot(t, root, populatedFiles, "{\"claims\":[{\"type\":\"typescript\",\"root\":\"../shared\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/**\"],\"symbol\":\"h2\"}}]}"), "\n")
  if !strings.Contains(populated, "Missing acknowledgement for 'docs/spec.md#alpha'") {
    t.Fatalf("the rooted population must activate when its first selected Program declaration is supplied: %s", populated)
  }

}
