package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatStructuralRulesConvergeOnHeadlineInput verifies the
// full `ttsc format` cascade fixes the structural-formatting headline
// bug: four statements crammed onto one indented line, with trailing
// blank lines, converge to one statement per line at column 0 with a
// single final newline, and `console.log(...)` does NOT over-break.
//
// This is the end-to-end proof for the three new always-on rules
// (`format/statement-split`, `format/indent`, `format/whitespace`)
// composing with `format/semi`, `format/print-width`, and friends. It
// also pins that print-width self-heals: once statement-split puts the
// call on its own line at column 0, a later pass collapses it flat
// instead of leaving it broken.
//
//  1. Seed a project plus a `format` block config (always-on rules).
//  2. Run `ttsc format`.
//  3. Assert the file converges to the canonical Prettier output and the
//     subcommand exits cleanly.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on one indented line holding four statements followed by blank and whitespace-only lines, and requires exit 0, empty output and the exact four-line file at column 0 with a single final newline and `console.log(a, b, c);` kept flat.
// @evidence contracts/testing.md#independent-expectations The expected four-line text is an authored literal; the console.log call is 21 columns, so staying flat is the correct answer regardless of how the cascade got there.
// @evidence contracts/testing.md#distinguishing-cases One input that changes in several ways at once (statement split, de-indent, trailing blank-line removal, no over-break); a failure in any of those rules or in their composition changes the output text.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatStructuralRulesConvergeOnHeadlineInput(t *testing.T) {
  source := "  const a: string = \"Hello, World!\"; let b: number = 42; var c: boolean = true; console.log(a, b, c);\n\n\n  \n"
  want := "const a: string = \"Hello, World!\";\n" +
    "let b: number = 42;\n" +
    "var c: boolean = true;\n" +
    "console.log(a, b, c);\n"
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
    t.Fatalf("cascaded output mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
