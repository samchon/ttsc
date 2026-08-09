package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatBraceContinuationPushesPastALabelPrefix verifies a labeled statement
// still pushes its continuation keyword down.
//
// The abstention for a statement that does not own its line is what keeps a
// keyword from landing at column zero, and a label prefix trips it. Unlike a
// preceding statement, a label is never split off onto its own line by any pass,
// so refusing here would strand the keyword permanently rather than deferring
// it. The prefix is accepted only when it is whitespace and `identifier :` runs.
//
//  1. Seed a project with a labeled one-line `if`/`else` inside a function.
//  2. Run `ttsc format`.
//  3. Assert `else` lands on its own line at the statement's column.
func TestFormatBraceContinuationPushesPastALabelPrefix(t *testing.T) {
  root := seedLintProject(t, "function f() {\n  outer: if (a) x(); else y();\n}\n")
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
  want := "function f() {\n  outer: if (a) x();\n  else y();\n}\n"
  if string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
