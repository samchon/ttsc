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
// FIX C completion: the decorated-member header pass already moved decorator
// lines for class MEMBERS, but a decorated nested declaration STATEMENT was
// handled by the statement pass, which re-indented only lineStart(stmt.Pos())
// — the leading `@` — and left the `class B` declaration line at column 0. The
// statement pass now mirrors the header pass for decorated declarations.
//
//  1. Flatten a function-nested decorated class canonical to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises restores decorated nested class indent from flat and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert it converges and restores the canonical exactly.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: The statement pass now mirrors the header pass for decorated declarations. . The asserted decision is: Assert it converges and restores the canonical exactly. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatRestoresDecoratedNestedClassIndentFromFlat owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
