package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresNestedClassIndentFromFlat verifies the `ttsc
// format` cascade re-indents a class nested inside a function — its
// declaration line, member header, body, and BOTH closing braces — from a
// fully flattened source. ttsc-only self-check against the canonical answer
// key; Prettier is not used.
//
// A class body is not a Block node, so its closing `}` is re-indented by the
// closing-brace pass's class branch (added alongside the switch CaseBlock
// fix); a nested class exercises that at a non-zero depth.
//
//  1. Flatten a function-nested class canonical to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
// @evidence contracts/testing.md#behavioral-verification Strips the leading whitespace from every line of an authored function containing a nested class `C` with a method, runs the in-process `format` command (semi false), and requires exit 0 without a did-not-converge message and the file equal to the authored indented text, including both closing braces.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored canonical literal; the flat input is derived from it by removing leading whitespace, which leaves the syntax tree identical.
// @evidence contracts/testing.md#distinguishing-cases One input that must change at a non-zero nesting depth: class line, member header, body and the class and method closing braces all start at column 0; a class body is not a Block, so its closing brace needs its own branch.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatRestoresNestedClassIndentFromFlat(t *testing.T) {
  canonical := "function f() {\n" +
    "  class C {\n" +
    "    m() {\n" +
    "      g()\n" +
    "    }\n" +
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
    t.Fatalf("nested class indent not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
