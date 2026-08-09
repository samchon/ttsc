package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinJoinsElseIfChainAcrossLines verifies an `else` whose alternate is an `if` collapses the whole chain.
//
// Prettier prints an `else if` chain flat, so the alternate being an `if` is
// exempt from the single-line-body guard. Hoisting it also moves its
// continuation lines, and the inner join then contends for the same bytes, so
// the chain settles over two cascade passes rather than one. The command is the
// level that contract lives at, and `ttsc format` runs the cascade to a fixed
// point.
//
//  1. Seed a project with an `else` whose alternate is an `if` across two lines.
//  2. Run `ttsc format`.
//  3. Assert the chain collapses to `else if (b) y();`.
func TestFormatClauseJoinJoinsElseIfChainAcrossLines(t *testing.T) {
  root := seedLintProject(t, "if (a)\n  x();\nelse\n  if (b)\n    y();\n")
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
  if want := "if (a) x();\nelse if (b) y();\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
