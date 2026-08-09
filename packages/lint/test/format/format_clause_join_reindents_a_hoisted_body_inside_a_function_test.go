package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinReindentsAHoistedBodyInsideAFunction verifies the shift is a delta rather than a reset to column zero.
//
// At top level the header's own indent is empty, so a shift that reset every
// continuation line to column zero would pass the sibling cases. Nesting the
// chain inside a function is what distinguishes a delta from a reset.
//
//  1. Seed a project with an `else if` chain nested inside a function body.
//  2. Run `ttsc format`.
//  3. Assert the chain lands at the function body's column, not at zero.
func TestFormatClauseJoinReindentsAHoistedBodyInsideAFunction(t *testing.T) {
  root := seedLintProject(t, "function f() {\n  if (a)\n    x();\n  else\n    if (b)\n      y();\n}\n")
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
  if want := "function f() {\n  if (a) x();\n  else if (b) y();\n}\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
