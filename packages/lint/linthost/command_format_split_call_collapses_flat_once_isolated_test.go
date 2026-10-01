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
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on one line holding two declarations and a six-argument `console.log` call (88 columns with the 2-space indent, 60 for the call alone), and requires exit 0, empty output and the exact file with three statements on their own lines and the call kept flat.
// @evidence contracts/testing.md#independent-expectations The expected three-line file is an authored literal; the column arithmetic in the test comment (88 and 60 columns) is the reasoning that makes the flat call correct, not formatter output.
// @evidence contracts/testing.md#distinguishing-cases One changing case that separates a cascade which keeps the call exploded because it overflowed when sharing a line from one which re-measures it after the statement split; the argument list must end up inline.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
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
