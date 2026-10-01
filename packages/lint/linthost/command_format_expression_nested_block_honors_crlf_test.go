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
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command with endOfLine crlf on `run(() => { a(); });` (CRLF terminated) and requires the exact output `run(() => {\r\n  a();\r\n});\r\n`, then checks that no lone LF remains once CRLF pairs are removed.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored literal with explicit `\r\n` at every break; the lone-LF check is a second assertion derived from the endOfLine contract, not from formatter output.
// @evidence contracts/testing.md#distinguishing-cases One changing case covering both line breaks the block printer inserts (after `{` and before `}`); only the crlf setting is exercised, so LF output and mixed-ending input are not covered here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: seeds a temp-dir project and calls run with the format subcommand via formatOnceForBrace; no child process, built binary or installed consumer.
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
