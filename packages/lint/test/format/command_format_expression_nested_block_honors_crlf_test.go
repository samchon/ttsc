package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatExpressionNestedBlockHonorsCRLF verifies every hard line
// inserted for #922 uses the configured file ending.
//
// The block printer creates both the line after `{` and the line before `}`.
// A bare LF in either position would reintroduce the mixed-ending defect #616
// fixed.
//
//  1. Seed a one-line callback with CRLF output configured.
//  2. Run `ttsc format`.
//  3. Require the Prettier shape and reject every lone LF.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises expression nested block honors crlf and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Require the Prettier shape and reject every lone LF.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed a one-line callback with CRLF output configured. The asserted decision is: Require the Prettier shape and reject every lone LF. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatExpressionNestedBlockHonorsCRLF owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatExpressionNestedBlockHonorsCRLF(t *testing.T) {
  source := "run(() => { a(); });\r\n"
  want := "run(() => {\r\n  a();\r\n});\r\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"endOfLine": "crlf"},
  })
  main := filepath.Join(root, "src", "main.ts")

  got := formatOnceForBrace(t, root, main)
  if got != want {
    t.Fatalf("inserted break must honor CRLF:\ngot  %q\nwant %q", got, want)
  }
  if strings.Contains(strings.ReplaceAll(got, "\r\n", ""), "\n") {
    t.Fatalf("lone LF survived a CRLF file: %q", got)
  }
}
