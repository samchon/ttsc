package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinLeavesAStringContinuationUntouched verifies the shift never rewrites bytes inside a string literal.
//
// A string literal with a line continuation carries its own newline, and the
// spaces after it are part of the value. Shifting that line collapsed the run
// of spaces inside the value, changing what the program prints rather than how
// it reads. Only the template literal was guarded; a string is the same hazard.
//
//  1. Seed a project with a label whose body holds a line-continued string.
//  2. Run `ttsc format`.
//  3. Assert the label joins and the string's interior spacing is byte-identical.
func TestFormatClauseJoinLeavesAStringContinuationUntouched(t *testing.T) {
  root := seedLintProject(t, "outer:\n  run(\"a\\\n   b\");\n")
  seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if want := "outer: run(\"a\\\n   b\");\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
