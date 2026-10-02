package linthost

import (
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
// The fixture is a long import with a single-quoted module specifier and no
// trailing semicolon (print-width, quotes and semi join) followed by a long
// single-line object (reflow and trailing comma).
//
//  1. Seed the two declarations and a lint.config.json whose format block sets
//     printWidth 20; the four format rules are always on.
//  2. Run `ttsc format`.
//  3. Assert the exact authored output and a clean exit with no output.
//
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command with format.printWidth 20 on a single-quoted, unterminated import plus a one-line object literal and requires exit 0, empty output and the whole file equal to an authored text with the import broken, double-quoted and terminated, and the object broken with a trailing comma.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored literal (double quotes, semicolons, trailing commas, one member per line) following from the default format rules; it is not derived from formatter output.
// @evidence contracts/testing.md#distinguishing-cases One input that needs print-width, quotes, semi and trailing-comma together; a duplicate semicolon (`;;`) from print-width plus semi, or a missing quote conversion, would differ from the literal text. Only a single import and object are covered.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatPrintWidthCascadesWithSemiAndQuotes(t *testing.T) {
  source := "import { alpha, bravo, charlie } from 'long-module'\n" +
    "const x = { aa: 1, bb: 2, cc: 3 };\n"
  want := "import {\n  alpha,\n  bravo,\n  charlie,\n} from \"long-module\";\n" +
    "const x = {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};\n"
  root := seedLintProject(t, source)
  // All formatting is configured through the format block (the only
  // formatting surface): printWidth drives format/print-width, and
  // format/semi, format/quotes, format/trailing-comma are always on.
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
  if string(got) != want {
    t.Fatalf("cascaded output mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
