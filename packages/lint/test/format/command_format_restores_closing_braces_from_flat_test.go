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
// This is a ttsc-only self-check: a canonical (ground-truth) source is
// mangled by stripping every line's leading whitespace to column 0 — a
// transform that leaves the AST identical — and `ttsc format` must restore
// the canonical byte-for-byte. Prettier is intentionally NOT used as the
// oracle; the canonical string is the answer key.
//
// Before the closing-brace pass in format/indent, the statements were
// re-indented while the `}` lines stayed at column 0, so the cascade
// reported success (exit 0) on a malformed result.
//
//  1. Build a flat (column-0) version of a nested-block canonical.
//  2. Run `ttsc format`.
//  3. Assert it converges and the output equals the canonical exactly.
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
