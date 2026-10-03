package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFixAppliesBothLintAndFormatRuleEdits verifies that one fix command
// applies configured lint and format edits through its bounded cascade.
//
// Fix promotes the format rules supplied by an explicit format block, even
// when their check-time severity is off. It does not supply the default format
// options that the format command can introduce without that block.
//
// 1. Seed var and three unterminated statements.
// 2. Enable no-var and configure semi through the format block.
// 3. Assert successful silent completion and the entire final rewritten file.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `fix` command over a project with `var legacy` and unterminated statements, configured with format.semi and the no-var rule, and asserts exit 0, empty stdout and stderr, and the complete rewritten file.
// @evidence contracts/testing.md#independent-expectations The expected file `let legacy = 1;\nJSON.stringify(legacy);\nexport {};\n` is an authored literal following from no-var (var to let) and semi true; it is not produced by applying returned fixes.
// @evidence contracts/testing.md#distinguishing-cases A single positive scenario requires the final var-to-let and three semicolon changes with all other bytes preserved. It does not assert the number of cascade passes or emitted edits; the fix-defaults sibling owns the unconfigured-format contrast.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the fix subcommand on a temp-dir project and reads the rewritten file back; no child process, built binary or installed consumer.
func TestCommandFixAppliesBothLintAndFormatRuleEdits(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1\nJSON.stringify(legacy)\nexport {}\n")
  // format/semi via the format block (the only formatting surface); no-var
  // is a genuine lint rule.
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"semi": true},
    "rules":  map[string]any{"no-var": "error"},
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "fix",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("fix command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  // The final source must contain both no-var and format/semi changes.
  want := "let legacy = 1;\nJSON.stringify(legacy);\nexport {};\n"
  if string(got) != want {
    t.Fatalf("fixed source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
