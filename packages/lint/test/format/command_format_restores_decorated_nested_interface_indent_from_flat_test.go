package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresDecoratedNestedInterfaceIndentFromFlat verifies the
// `ttsc format` cascade re-indents a decorated interface DECLARATION STATEMENT
// nested inside a `namespace` — its decorator line AND its `interface I`
// declaration line — from a fully flattened source. ttsc-only self-check.
//
// FIX C completion: the parser attaches the leading `@Dec` to the
// InterfaceDeclaration's Decorators() (verified by probe), so a decorated
// interface is a decorated declaration statement just like a class. Before the
// completion the statement pass moved only the `@` line and left `interface I`
// at column 0; the declaration-line re-indent now generalizes to it.
//
//  1. Flatten a namespace-nested decorated interface canonical to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
// @evidence contracts/testing.md#behavioral-verification Strips the leading whitespace from every line of an authored `namespace N` containing a decorated `interface I { a: number }`, runs the in-process `format` command (semi false), and requires exit 0 without a did-not-converge message and the file equal to the authored indented text.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored canonical literal; the flat input is derived from it by removing leading whitespace, which leaves the syntax tree identical.
// @evidence contracts/testing.md#distinguishing-cases One input that must change: the `@Dec` line, the `interface I` line, its member and both closing braces start at column 0; a re-indent covering only classes and functions would leave `interface I` at column 0.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatRestoresDecoratedNestedInterfaceIndentFromFlat(t *testing.T) {
  canonical := "namespace N {\n" +
    "  @Dec\n" +
    "  interface I {\n" +
    "    a: number\n" +
    "  }\n" +
    "}\n"
  var flat strings.Builder
  for _, line := range strings.Split(canonical, "\n") {
    flat.WriteString(strings.TrimLeft(line, " \t"))
    flat.WriteString("\n")
  }
  source := strings.TrimSuffix(flat.String(), "\n")

  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{"format": map[string]any{"semi": false}})
  main := filepath.Join(root, "src", "main.ts")

  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{"format", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 0 || strings.Contains(stderr, "did not converge") {
    t.Fatalf("format did not converge: code=%d stderr=%q", code, stderr)
  }
  got, err := os.ReadFile(main)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != canonical {
    t.Fatalf("decorated nested interface indent not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
