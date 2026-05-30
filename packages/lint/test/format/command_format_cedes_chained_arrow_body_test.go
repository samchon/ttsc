package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatCedesChainedArrowBody verifies the `ttsc format` cascade
// leaves a chained-arrow body (`a => b => { … }`) untouched. The inner
// arrow's body hangs under the outer arrow's `=>` continuation, so its
// indent is not depth*tabWidth from column 0; format/indent cedes it
// structurally (not by inspecting the possibly-mangled opener indent), so a
// naive re-indent cannot de-indent this correct source.
//
//  1. Seed the chained-arrow canonical (already correct).
//  2. Run `ttsc format`.
//  3. Assert it converges and leaves the source unchanged.
func TestCommandFormatCedesChainedArrowBody(t *testing.T) {
  canonical := "export const h =\n" +
    "  (a: number) =>\n" +
    "  (b: number) => {\n" +
    "    return a + b\n" +
    "  }\n"

  root := seedLintProject(t, canonical)
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
    t.Fatalf("chained arrow body changed:\ngot  %q\nwant %q", string(got), canonical)
  }
}
