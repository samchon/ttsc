package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresClosingBracesFromFlat verifies the `ttsc format`
// cascade re-indents a block's closing `}` lines, not just its statements.
//
// An independently authored source is
// mangled by stripping every line's leading whitespace to column 0 — a
// transform that leaves the AST identical — and `ttsc format` must restore
// the canonical byte-for-byte. Prettier is intentionally NOT used as the
// oracle; the canonical string is the answer key.
//
// A formatter that moved only statements could converge while leaving the
// closing braces at column 0. Whole-file equality rejects that incomplete
// transformation as well as changes to the function, conditions or call.
//
//  1. Build a flat (column-0) version of a nested-block canonical.
//  2. Run `ttsc format`.
//  3. Assert it converges and the output equals the canonical exactly.
//
// @evidence contracts/testing.md#behavioral-verification Strips the leading whitespace from every line of an authored function with two nested `if` blocks, runs the in-process `format` command (semi false), and requires exit 0 without a did-not-converge message and the file equal to the authored indented text.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored canonical literal; the flat input is derived from it by removing leading whitespace, which leaves the syntax tree identical.
// @evidence contracts/testing.md#distinguishing-cases One input that must change: statements and all three closing `}` lines start at column 0; re-indenting statements alone would leave the braces at column 0. Only nested if blocks are covered; class and switch braces are owned by sibling tests.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatRestoresClosingBracesFromFlat(t *testing.T) {
  canonical := "function g() {\n" +
    "  if (a) {\n" +
    "    if (b) {\n" +
    "      doThing()\n" +
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
    t.Fatalf("closing braces not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
