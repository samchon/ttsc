package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatStructuralRulesAreIdempotentOnTheirOwnOutput verifies
// the `ttsc format` cascade leaves its own canonical output untouched.
//
// A formatter must be a fixed point: re-feeding already-formatted source
// must produce zero edits. This guards against rules that fight each
// other across passes (the class-body depth regression, where indent
// rewrote correct four-space bodies back to two, is the motivating
// example). Feeding the converged headline output back through `format`
// must yield byte-identical source.
//
//  1. Seed a project whose source is already the canonical cascade output.
//  2. Run `ttsc format`.
//  3. Assert the file is unchanged and the subcommand exits cleanly.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command with an empty format block on a four-statement file that is already one statement per line with semicolons, and requires exit 0, empty output and the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The canonical source is an authored literal that serves as its own expected output; it is not derived from the formatter.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case guarding against format rules undoing each other's output (for example indent rewriting correct bodies). Only simple top-level statements are used, so class bodies and nested blocks are covered by other tests.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatStructuralRulesAreIdempotentOnTheirOwnOutput(t *testing.T) {
  canonical := "const a: string = \"Hello, World!\";\n" +
    "let b: number = 42;\n" +
    "var c: boolean = true;\n" +
    "console.log(a, b, c);\n"
  root := seedLintProject(t, canonical)
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
  if string(got) != canonical {
    t.Fatalf("format is not idempotent:\nwant %q\ngot  %q", canonical, string(got))
  }
}
