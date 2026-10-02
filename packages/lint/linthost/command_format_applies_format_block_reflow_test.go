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
// This is the headline command-level test for the format surface, and the
// regression guard for the dropped-`format` bug: a config file whose
// only key is `format` must round-trip from `lint.config.json` through the
// loader, expansion, and engine. A regression at any of those layers would
// surface here.
//
//  1. Seed a project plus a lint.config.json carrying only
//     `format: { printWidth: 20 }`.
//  2. Run the format subcommand.
//  3. Assert the file is the reflowed multi-line form and the
//     subcommand exits cleanly.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on `const x = { aa: 1, bb: 2, cc: 3 };` with a lint.config.json whose only key is `format: { printWidth: 20 }`, and asserts exit 0, empty output, and the complete reflowed file.
// @evidence contracts/testing.md#independent-expectations The expected multi-line object with a trailing comma is an authored literal following from a 20-column print width; it is not derived from running the formatter.
// @evidence contracts/testing.md#distinguishing-cases One positive case: an object overflowing width 20 must break one member per line. The config has no rules entry, so the format block alone drives the edit; no under-width negative case is included here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand over a temp-dir project and JSON config; no child process, built binary or installed consumer.
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
