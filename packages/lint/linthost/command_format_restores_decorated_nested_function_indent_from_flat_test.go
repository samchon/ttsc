package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresDecoratedNestedFunctionIndentFromFlat verifies the
// `ttsc format` cascade re-indents a decorated function DECLARATION STATEMENT
// nested inside another function — its decorator line AND its `function f`
// declaration line — from a fully flattened source. ttsc-only self-check.
//
// The fixture places `@Dec` above a nested function declaration. Whole-file
// equality requires both lines to move together, distinguishing declaration
// alignment beyond the separate class fixtures. This formatting check does
// not assert that decorators on functions are accepted by typechecking.
//
//  1. Flatten a function-nested decorated function canonical to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
//
// @evidence contracts/testing.md#behavioral-verification Strips the leading whitespace from every line of an authored function containing a decorated nested `function f` and a `return f`, runs the in-process `format` command (semi false), and requires exit 0 without a did-not-converge message and the file equal to the authored indented text.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored canonical literal; the flat input is derived from it by removing leading whitespace, which leaves the syntax tree identical.
// @evidence contracts/testing.md#distinguishing-cases One input that must change: the `@Dec` line and the nested `function f` declaration line start at column 0 and both must move, showing the declaration re-indent is not limited to classes.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatRestoresDecoratedNestedFunctionIndentFromFlat(t *testing.T) {
  canonical := "function outer() {\n" +
    "  @Dec\n" +
    "  function f() {\n" +
    "    g()\n" +
    "  }\n" +
    "  return f\n" +
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
    t.Fatalf("decorated nested function indent not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
