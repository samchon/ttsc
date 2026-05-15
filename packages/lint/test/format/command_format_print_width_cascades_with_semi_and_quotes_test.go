package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatPrintWidthCascadesWithSemiAndQuotes verifies the
// `ttsc format` cascade converges to a single fixed-point output when
// `format/print-width`, `format/semi`, `format/quotes`, and
// `format/trailing-comma` are all enabled together.
//
// Beyond demonstrating multi-rule integration, this case is the
// regression guard for an earlier bug where
// `printImportDeclaration` unconditionally appended `;`. Combined
// with `format/semi`'s zero-width insert at the same `node.End()`,
// that double-emit produced `;;` on imports the user wrote without
// a terminator. The non-overlap check in the applier did not catch
// it (zero-width insert + same-end replacement do not "overlap" by
// position math) and neither rule could undo the duplicate on
// subsequent passes. The cascade silently converged to broken output.
//
// The fixture exercises:
//
//   - a long single-line object (reflow + trailing comma)
//
//   - a long import with single-quoted module specifier and
//     no trailing semicolon (print-width + quotes + semi join)
//
//     1. Seed the project, enable all four rules at error.
//     2. Run `ttsc format`.
//     3. Assert the file is the canonical Prettier output and the
//     subcommand exits cleanly.
func TestCommandFormatPrintWidthCascadesWithSemiAndQuotes(t *testing.T) {
  source := "import { alpha, bravo, charlie } from 'long-module'\n" +
    "const x = { aa: 1, bb: 2, cc: 3 };\n"
  want := "import {\n  alpha,\n  bravo,\n  charlie,\n} from \"long-module\";\n" +
    "const x = {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};\n"
  root := seedLintProject(t, source)
  manifest := manifestWithFourFormatRules(t)
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
  if string(got) != want {
    t.Fatalf("cascaded output mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}

// manifestWithFourFormatRules encodes a plugins manifest enabling
// print-width (with a tight printWidth), semi, quotes, and
// trailing-comma all at error severity.
func manifestWithFourFormatRules(t *testing.T) string {
  t.Helper()
  rules := map[string]any{
    "format/print-width":    []any{"error", map[string]any{"printWidth": 20}},
    "format/semi":           "error",
    "format/quotes":         "error",
    "format/trailing-comma": "error",
  }
  data, err := json.Marshal([]map[string]any{{
    "name":  "@ttsc/lint",
    "stage": "check",
    "config": map[string]any{
      "rules": rules,
    },
  }})
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}
