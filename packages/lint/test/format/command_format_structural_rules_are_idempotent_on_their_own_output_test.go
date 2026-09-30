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
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises structural rules are idempotent on their own output and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert the file is unchanged and the subcommand exits cleanly.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed a project whose source is already the canonical cascade output. The asserted decision is: Assert the file is unchanged and the subcommand exits cleanly. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatStructuralRulesAreIdempotentOnTheirOwnOutput owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
