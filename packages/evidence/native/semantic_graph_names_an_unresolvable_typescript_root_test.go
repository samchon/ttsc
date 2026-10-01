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
 * A missing directory contrasts with a repaired Program population carrying a valid Alpha citation and the same population without it; the glob warning must not replace the root cause.
 *
 * 1. graphRule.Check names the missing ../absent root, accepts Program-supplied Ready citing Alpha after repair, and reports missing Alpha when that citation is removed.
 * 2. The literal absent-root diagnostic and docs/spec.md#alpha obligation specify failure, cited recovery, and uncited population failure independently of emitted output.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check names the missing ../absent root, accepts Program-supplied Ready citing Alpha after repair, and reports missing Alpha when that citation is removed.
 * @evidence contracts/testing.md#independent-expectations The literal absent-root diagnostic and docs/spec.md#alpha obligation specify failure, cited recovery, and uncited population failure independently of emitted output.
 * @evidence contracts/testing.md#distinguishing-cases A missing directory contrasts with a repaired Program population carrying a valid Alpha citation and the same population without it; the glob warning must not replace the root cause.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphNamesAnUnresolvableTypescriptRoot owns these assertions. runIndexRuleAtRoot parses supplied Ready source into ctx.Sources and invokes graphRule.Check before root repair and with cited/uncited Program populations; no consumer install runs.
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
  repairedSource := filepath.Join(root, "..", "absent", "src", "Ready.ts")
  if err := os.MkdirAll(filepath.Dir(repairedSource), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(repairedSource, []byte("/** @evidence docs/spec.md#alpha Covers Alpha. */\nexport interface Ready {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  repairedFiles := make(map[string]string, len(files)+1)
  for filename, content := range files {
    repairedFiles[filename] = content
  }
  repairedFiles["../absent/src/Ready.ts"] = "/** @evidence docs/spec.md#alpha Covers Alpha. */\nexport interface Ready {}\n"
  repaired := runIndexRuleAtRoot(t, root, repairedFiles, "{\"claims\":[{\"type\":\"typescript\",\"root\":\"../absent\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/**\"],\"symbol\":\"h2\"}}]}")
  if len(repaired) != 0 {
    t.Fatalf("a repaired rooted population and valid citation must be silent: %s", strings.Join(repaired, "\n"))
  }
  repairedFiles["../absent/src/Ready.ts"] = "export interface Ready {}\n"
  uncited := strings.Join(runIndexRuleAtRoot(t, root, repairedFiles, "{\"claims\":[{\"type\":\"typescript\",\"root\":\"../absent\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/**\"],\"symbol\":\"h2\"}}]}"), "\n")
  if !strings.Contains(uncited, "Missing acknowledgement for 'docs/spec.md#alpha'") {
    t.Fatalf("the repaired Program population must enforce Alpha: %s", uncited)
  }

}
