package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatAppliesFormatBlockReflow verifies the `ttsc format`
// subcommand applies edits driven entirely by a `format` block in the
// discovered lint config file — no `format/*` entries in `rules`.
//
// This is the headline end-to-end test for the format surface, and the
// e2e-level regression guard for the dropped-`format` bug: a config file whose
// only key is `format` must round-trip from `lint.config.json` through the
// loader, expansion, and engine. A regression at any of those layers would
// surface here.
//
//  1. Seed a project plus a lint.config.json carrying only
//     `format: { printWidth: 20 }`.
//  2. Run the format subcommand.
//  3. Assert the file is the reflowed multi-line form and the
//     subcommand exits cleanly.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises applies format block reflow and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert the file is the reflowed multi-line form and the subcommand exits cleanly.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed a project plus a lint.config.json carrying only `format: { printWidth: 20 }`. The asserted decision is: Assert the file is the reflowed multi-line form and the subcommand exits cleanly. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatAppliesFormatBlockReflow owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatAppliesFormatBlockReflow(t *testing.T) {
  root := seedLintProject(t, "const x = { aa: 1, bb: 2, cc: 3 };\n")
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"printWidth": 20},
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
  want := "const x = {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};\n"
  if string(got) != want {
    t.Fatalf("output mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
