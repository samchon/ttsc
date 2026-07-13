package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFixLeavesSuggestionOnlyRulesUnchanged verifies the disk-writing
// CLI keeps both upstream suggestions out of its automatic cascade while still
// reporting their diagnostics.
func TestCommandFixLeavesSuggestionOnlyRulesUnchanged(t *testing.T) {
  source := `// @ts-ignore: the next line is intentionally error-free
const value: number = 1;
async function main(): Promise<void> {
  await value;
}
void main();
`
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{
    "typescript/await-thenable": "error",
    "typescript/ban-ts-comment": "error",
  })

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return RunFix([]string{
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("RunFix mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  for _, ruleName := range []string{"typescript/await-thenable", "typescript/ban-ts-comment"} {
    if !strings.Contains(stderr, "["+ruleName+"]") {
      t.Fatalf("missing %s diagnostic:\n%s", ruleName, stderr)
    }
  }
  assertFileText(t, filepath.Join(root, "src", "main.ts"), source)
}
