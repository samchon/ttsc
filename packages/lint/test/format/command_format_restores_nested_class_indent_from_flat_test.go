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
