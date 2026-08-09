package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinLeavesABlockCommentInteriorUntouched verifies the shift never rewrites a block comment's continuation lines.
//
// Prettier prints a non-JSDoc block comment verbatim, so its interior columns are
// content the author chose. This is the third member of the same class as the
// string and template cases, and the one a reader is least likely to expect.
//
//  1. Seed a project with a labeled loop whose body holds a multi-line block comment.
//  2. Run `ttsc format`.
//  3. Assert the label joins and the comment's own lines keep their columns.
func TestFormatClauseJoinLeavesABlockCommentInteriorUntouched(t *testing.T) {
  root := seedLintProject(t, "outer:\n  for (const x of xs) {\n    /* a\n       b */\n    visit(x);\n  }\n")
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
  if want := "outer: for (const x of xs) {\n  /* a\n       b */\n  visit(x);\n}\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
