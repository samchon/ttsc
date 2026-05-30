package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresSwitchCaseBodyFromFlat verifies the `ttsc
// format` cascade re-indents switch case labels and their bodies from a
// fully flattened source. ttsc-only self-check against the canonical answer
// key; Prettier is not used.
//
// The same false-cede that broke class method bodies left switch case
// bodies at column 0 (only `switch (x) {` was fixed). The structural
// chained-arrow cede guard fixed it.
//
//  1. Flatten a switch canonical (block and non-block cases) to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
func TestCommandFormatRestoresSwitchCaseBodyFromFlat(t *testing.T) {
  canonical := "function h(x) {\n" +
    "  switch (x) {\n" +
    "    case 1:\n" +
    "      doA()\n" +
    "      break\n" +
    "    default:\n" +
    "      doB()\n" +
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
    t.Fatalf("switch case body not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
