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
