package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatSplitCallCollapsesFlatOnceIsolated verifies a call
// that overflows 80 columns while crammed onto an indented multi-statement
// line stays flat (does not over-break) once split onto its own line.
//
// The headline cascade test's `console.log(a, b, c)` is far under 80
// columns, so its "does not over-break" claim is vacuous. This case uses
// a call whose full crammed line exceeds 80 but whose isolated form at
// column 0 is under 80: after statement-split moves it to its own line,
// print-width must leave the arguments inline rather than exploding them.
//
//  1. Seed a project whose call overflows 80 only because it shares the
//     line with two preceding statements.
//  2. Run `ttsc format`.
//  3. Assert the call ends up flat on its own line at column 0.
func TestCommandFormatSplitCallCollapsesFlatOnceIsolated(t *testing.T) {
  // Crammed line is 88 columns (>80); the call alone is 60 columns (<80).
  source := "  const a = 1; const b = 2; console.log(\"aaaa\", \"bbbb\", \"cccc\", \"dddd\", \"eeee\", \"ffff\");\n"
  want := "const a = 1;\n" +
    "const b = 2;\n" +
    "console.log(\"aaaa\", \"bbbb\", \"cccc\", \"dddd\", \"eeee\", \"ffff\");\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{},
  })
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
  if string(got) != want {
    t.Fatalf("split call should collapse flat:\nwant %q\ngot  %q", want, string(got))
  }
}
