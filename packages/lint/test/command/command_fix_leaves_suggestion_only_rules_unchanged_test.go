package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFixLeavesSuggestionOnlyRulesUnchanged verifies the disk-writing
// CLI keeps both upstream suggestions out of its automatic cascade while still
// reporting their diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Actual RunFix reports both await-thenable and ban-ts-comment errors with status two and empty stdout while preserving every original source byte instead of applying suggestion-only choices automatically.
// @evidence contracts/testing.md#independent-expectations Authored error-free ts-ignore target and await of a number independently trigger the two configured rules; original complete source bytes establish the required no-autofix outcome separately from rendered diagnostics.
// @evidence contracts/testing.md#distinguishing-cases Two distinct suggestion-only producers must both remain reported and untouched, contrasting with automatic cascades in the sibling fix unit; configured error severity prevents silence from satisfying preservation.
// @evidence contracts/testing.md#execution-ownership Real in-process command, checker-dependent rules and temporary file reads execute together without building native contributor sources, installing a consumer or invoking a CLI child.
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
