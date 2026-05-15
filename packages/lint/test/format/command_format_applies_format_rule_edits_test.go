package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatAppliesFormatRuleEdits verifies the format command writes
// edits from FormatRule implementations and leaves lint-class rules alone.
//
// The split between fix and format is the load-bearing contract: a user who
// runs `ttsc --format` expects only formatter-class edits, not lint rewrites.
// This scenario enables a format rule and a lint rule on the same project
// and asserts the file changes mirror the format rule's edit set only.
//
// 1. Seed a project with a no-var violation and a missing-semi violation.
// 2. Run the format subcommand with both rules enabled.
// 3. Assert the file gains semicolons but keeps its `var` declaration.
func TestCommandFormatAppliesFormatRuleEdits(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1\nJSON.stringify(legacy)\n")
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t, map[string]string{
        "format/semi": "error",
        "no-var":      "error",
      }),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  // format/semi applied: trailing semicolons. no-var did NOT apply: `var`
  // remains (its TextEdit was filtered out because no-var is a lint rule).
  want := "var legacy = 1;\nJSON.stringify(legacy);\n"
  if string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
