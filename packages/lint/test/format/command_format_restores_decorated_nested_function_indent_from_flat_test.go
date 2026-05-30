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
// FIX C completion: the parser attaches the leading `@Dec` to the
// FunctionDeclaration's Decorators() (verified by probe), so a decorated
// nested function is a decorated declaration statement. Before the completion
// the statement pass moved only the `@` line and left `function f` at column
// 0. The statement pass now re-indents the declaration line of any decorated
// declaration, not just classes.
//
//  1. Flatten a function-nested decorated function canonical to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
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
