package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinReindentsAHoistedElseIfChain verifies a hoisted `else if` chain carries its continuation lines to the new column.
//
// An `else if` chain is one of the two clauses that may hoist a multi-line body.
// Moving only its first line left the trailing `else` at the column it had under
// the old layout, and no rule owns that column afterwards, so `ttsc format`
// settled on output Prettier still reindents (#1139).
//
//  1. Seed a project with a three-level `else if` chain written across lines.
//  2. Run `ttsc format`.
//  3. Assert the whole chain lands at the outer statement's column.
func TestFormatClauseJoinReindentsAHoistedElseIfChain(t *testing.T) {
  root := seedLintProject(t, "if (a)\n  x();\nelse\n  if (b)\n    y();\n  else\n    z();\n")
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
  if want := "if (a) x();\nelse if (b) y();\nelse z();\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
