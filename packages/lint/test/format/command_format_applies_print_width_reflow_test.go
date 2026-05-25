package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatAppliesPrintWidthReflow verifies the `ttsc format`
// subcommand applies formatPrintWidth edits to disk in a single
// pass.
//
// Going through the subcommand exercises the full path: rule
// loading, config-file discovery, engine run, finding application,
// post-write recheck. Unit tests so far have only covered the engine
// and the rule in isolation; this case proves the rule integrates
// with the existing format runner without special handling.
//
//  1. Seed a project with a long single-line object literal plus a
//     lint.config.json enabling formatPrintWidth with printWidth=20.
//  2. Run the format subcommand.
//  3. Assert the file on disk is the reflowed multi-line form and the
//     subcommand exits cleanly.
func TestCommandFormatAppliesPrintWidthReflow(t *testing.T) {
  root := seedLintProject(t, "const x = { aa: 1, bb: 2, cc: 3 };\n")
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "formatPrintWidth": []any{"error", map[string]any{"printWidth": 20}},
    },
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
    t.Fatalf("reformatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
