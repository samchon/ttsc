package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinKeepsABlankLineInsideAHoistedBody verifies a blank line inside a hoisted body neither shifts nor blocks the join.
//
// A blank line has no column to move. Charging it one produced a negative width
// for every ordinary outdent, and treating that as unshiftable abandoned the whole
// join, leaving `format/indent` to move the body's interior anyway and settling
// the file on a hybrid layout Prettier never emits.
//
//  1. Seed a project with a labeled loop whose body holds a blank line.
//  2. Run `ttsc format`.
//  3. Assert the label joins, the body outdents, and the blank line survives.
func TestFormatClauseJoinKeepsABlankLineInsideAHoistedBody(t *testing.T) {
  root := seedLintProject(t, "outer:\n  for (const x of xs) {\n    a();\n\n    b();\n  }\n")
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
  if want := "outer: for (const x of xs) {\n  a();\n\n  b();\n}\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
