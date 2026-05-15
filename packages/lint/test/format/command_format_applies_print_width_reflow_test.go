package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// manifestWithOptions encodes a single-rule plugins manifest where the
// rule entry is a `[severity, options]` tuple, the same shape the
// command package consumes via `--plugins-json`. The shared helper
// `lintManifest` only supports bare severities; this test-local
// builder threads options through.
func manifestWithOptions(t *testing.T, rule, severity, optsJSON string) string {
  t.Helper()
  var opts map[string]any
  if err := json.Unmarshal([]byte(optsJSON), &opts); err != nil {
    t.Fatalf("manifestWithOptions: decode opts: %v", err)
  }
  data, err := json.Marshal([]map[string]any{{
    "name":  "@ttsc/lint",
    "stage": "check",
    "config": map[string]any{
      "rules": map[string]any{
        rule: []any{severity, opts},
      },
    },
  }})
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

// TestCommandFormatAppliesPrintWidthReflow verifies the `ttsc format`
// subcommand applies format/print-width edits to disk in a single
// pass.
//
// Going through the subcommand exercises the full path: rule
// loading, manifest decoding, engine run, finding application,
// post-write recheck. Unit tests so far have only covered the engine
// and the rule in isolation; this case proves the rule integrates
// with the existing format runner without special handling.
//
//  1. Seed a project with a long single-line object literal.
//  2. Run the format subcommand with printWidth=20.
//  3. Assert the file on disk is the reflowed multi-line form and the
//     subcommand exits cleanly.
func TestCommandFormatAppliesPrintWidthReflow(t *testing.T) {
  root := seedLintProject(t, "const x = { aa: 1, bb: 2, cc: 3 };\n")
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", manifestWithOptions(t, "format/print-width", "error", `{"printWidth": 20}`),
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
