package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatBraceContinuationSettlesASharedLineThroughTheCascade verifies the deferred push lands at the right column on a later pass.
//
// The abstention is only correct if the cascade finishes the job. format/statement-split
// gives the `if` its own line first, and the next pass then reads a real column.
// This is the command-level proof that deferring is not dropping.
//
//  1. Seed a project whose `if`/`else` shares a line with a preceding statement.
//  2. Run `ttsc format`.
//  3. Assert `else` lands at the enclosing body's column, not at zero.
func TestFormatBraceContinuationSettlesASharedLineThroughTheCascade(t *testing.T) {
  root := seedLintProject(t, "function f() {\n  foo(); if (a) x(); else y();\n}\n")
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
  if want := "function f() {\n  foo();\n  if (a) x();\n  else y();\n}\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
