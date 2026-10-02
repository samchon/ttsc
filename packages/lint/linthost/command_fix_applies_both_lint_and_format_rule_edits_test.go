package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFixAppliesBothLintAndFormatRuleEdits verifies the
// `ttsc fix` contract: lint *and* format edits land in one pass.
//
// The companion `ttsc format` subcommand exists for the format-only
// case; the fix subcommand is the "run everything" entry point, so a
// user who runs `ttsc fix` doesn't have to chain a second `ttsc format`
// invocation. The intentional asymmetry — fix is a superset of format
// — is documented in the README's Fix section.
//
//  1. Seed a project with one lint-class violation (noVar) and one
//     format-class violation (formatSemi).
//  2. Run the fix subcommand with both rules enabled.
//  3. Assert both kinds of edits land and the final exit code is zero.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `fix` command over a project with `var legacy` and unterminated statements, configured with format.semi and the no-var rule, and asserts exit 0, empty stdout and stderr, and the complete rewritten file.
// @evidence contracts/testing.md#independent-expectations The expected file `let legacy = 1;\nJSON.stringify(legacy);\nexport {};\n` is an authored literal following from no-var (var to let) and semi true; it is not produced by applying returned fixes.
// @evidence contracts/testing.md#distinguishing-cases A single positive scenario where one lint edit and three format edits must land in one pass; it has no negative twin, and the fix-versus-format difference is owned by the sibling test.
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
  // `var` → `let` (noVar) and `;` appended (formatSemi) in one pass.
  want := "let legacy = 1;\nJSON.stringify(legacy);\nexport {};\n"
  if string(got) != want {
    t.Fatalf("fixed source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
