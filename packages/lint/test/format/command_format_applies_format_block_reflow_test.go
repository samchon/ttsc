package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatAppliesFormatBlockReflow verifies the `ttsc format`
// subcommand applies edits driven entirely by a `format` block — no
// `format/*` entries in `rules`.
//
// This is the headline end-to-end test for the new surface. A user
// writes a Prettier-style flat config; `ttsc format` enacts it. A
// regression at the manifest, loader, expansion, or engine layers
// would surface here.
//
//  1. Seed a project with a long single-line object literal.
//  2. Run the format subcommand with a manifest carrying only
//     `format: { printWidth: 20 }`.
//  3. Assert the file is the reflowed multi-line form and the
//     subcommand exits cleanly.
func TestCommandFormatAppliesFormatBlockReflow(t *testing.T) {
  root := seedLintProject(t, "const x = { aa: 1, bb: 2, cc: 3 };\n")
  manifest := formatBlockManifest(t, map[string]any{"printWidth": 20})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", manifest,
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

// formatBlockManifest builds a single-plugin manifest with the new
// `format` key (no `rules` field).
func formatBlockManifest(t *testing.T, format map[string]any) string {
  t.Helper()
  data, err := json.Marshal([]map[string]any{{
    "name":  "@ttsc/lint",
    "stage": "check",
    "config": map[string]any{
      "format": format,
    },
  }})
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}
