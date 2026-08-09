package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinChargesTheShiftToTheHeaderLinesIndent verifies the delta is the header line's indent, not the anchor token's column.
//
// For Prettier's own canonical `} else` placement the anchor token sits two
// columns in, so measuring from it charged the width of `} ` and shifted every
// continuation line two columns too far. Only a body `format/indent` cedes shows
// it, which is why a braced case would not.
//
//  1. Seed a project with a `} else` chain whose body is a labeled loop.
//  2. Run `ttsc format`.
//  3. Assert the nested body lands at Prettier's column.
func TestFormatClauseJoinChargesTheShiftToTheHeaderLinesIndent(t *testing.T) {
  root := seedLintProject(t, "if (a) {\n  x();\n} else\n  if (b)\n    outer: for (const x of xs) {\n      visit(x);\n    }\n")
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
  if want := "if (a) {\n  x();\n} else if (b)\n  outer: for (const x of xs) {\n    visit(x);\n  }\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
