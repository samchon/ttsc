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
func TestCommandFixAppliesBothLintAndFormatRuleEdits(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1\nJSON.stringify(legacy)\n")
  seedLintRules(t, root, map[string]string{
    "formatSemi": "error",
    "noVar":      "error",
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
  want := "let legacy = 1;\nJSON.stringify(legacy);\n"
  if string(got) != want {
    t.Fatalf("fixed source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
