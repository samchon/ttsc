package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFixSkipsFormatRuleEdits verifies fix never applies format edits.
//
// The dual of TestCommandFormatAppliesFormatRuleEdits: a user who runs
// `ttsc --fix` expects only lint rewrites, not formatter changes. Without an
// explicit filter, FormatRule findings would leak into `--fix`'s apply step
// the moment a project enabled both kinds of rules.
//
// 1. Seed a project with a no-var violation and a missing-semi violation.
// 2. Run the fix subcommand with both rules enabled.
// 3. Assert `var` becomes `let` but the missing semicolons are untouched.
func TestCommandFixSkipsFormatRuleEdits(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1\nJSON.stringify(legacy)\n")
  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "fix",
      "--cwd", root,
      "--plugins-json", lintManifest(t, map[string]string{
        "format/semi": "error",
        "no-var":      "error",
      }),
    })
  })
  // The final diagnostic pass still reports `format/semi` as an error
  // because fix did not apply its edits and the missing semicolons
  // remain. The exit code reflects that surviving diagnostic.
  if code != 2 {
    t.Fatalf("expected exit code 2 (format/semi still firing), got %d; stderr=%q", code, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  want := "let legacy = 1\nJSON.stringify(legacy)\n"
  if string(got) != want {
    t.Fatalf("fixed source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
