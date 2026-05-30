package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresSwitchIndentFromFlat verifies the `ttsc format`
// cascade re-indents switch case labels, their bodies, and the case-body
// block braces from a fully flattened source. ttsc-only self-check against
// the canonical answer key; Prettier is not used.
//
// A `case`/`default` label is not a statement, so the statement walk never
// visited it; and the closing-brace pass skipped the case-body block's `}`.
// Before the fix a flattened switch left labels and case-block braces at
// column 0 while the bodies were re-indented.
//
//  1. Flatten a switch canonical (block-bodied cases) to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
func TestCommandFormatRestoresSwitchIndentFromFlat(t *testing.T) {
  canonical := "function h(x) {\n" +
    "  switch (x) {\n" +
    "    case 1: {\n" +
    "      doA()\n" +
    "      break\n" +
    "    }\n" +
    "    default: {\n" +
    "      doB()\n" +
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
    t.Fatalf("switch indent not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
