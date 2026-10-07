package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresDecoratedNestedClassIndentFromFlat verifies the
// `ttsc format` cascade re-indents a decorated class DECLARATION STATEMENT
// nested inside a function — its decorator line AND its `class B` declaration
// line — from a fully flattened source. ttsc-only self-check against the
// canonical answer key; Prettier is not used at runtime.
//
// The decorated-member header pass moves decorator lines for class MEMBERS,
// while a decorated nested declaration STATEMENT is handled by the statement
// pass. That pass must also re-indent the `class B` declaration line, not only
// the leading `@` line at lineStart(stmt.Pos()), or the declaration would stay
// at column 0.
//
//  1. Flatten a function-nested decorated class canonical to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
//
// @evidence contracts/testing.md#behavioral-verification Strips the leading whitespace from every line of an authored function containing a decorated nested `class B` with a method and a `return B`, runs the in-process `format` command (semi false), and requires exit 0 without a did-not-converge message and the file equal to the authored indented text.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored canonical literal; the flat input is derived from it by removing leading whitespace, which leaves the syntax tree identical.
// @evidence contracts/testing.md#distinguishing-cases One input that must change: both the `@Dec` line and the `class B` declaration line of a function-nested decorated class start at column 0; moving only the `@` line would fail. Namespace-nested and interface forms are separate tests.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatRestoresDecoratedNestedClassIndentFromFlat(t *testing.T) {
  canonical := "function f() {\n" +
    "  @Dec\n" +
    "  class B {\n" +
    "    m() {\n" +
    "      g()\n" +
    "    }\n" +
    "  }\n" +
    "  return B\n" +
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
    t.Fatalf("decorated nested class indent not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
