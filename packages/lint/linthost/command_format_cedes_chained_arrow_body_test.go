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
// structurally (cededByChainedArrowAncestor), not by inspecting the
// possibly-mangled opener indent, so a naive re-indent cannot de-indent this
// correct source.
//
//  1. Seed the chained-arrow canonical (already correct).
//  2. Run `ttsc format`.
//  3. Assert it converges and leaves the source unchanged.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command (semi false) on a curried arrow `(a) =>\n  (b) => {` with a body hanging under the continuation indent, and asserts exit 0 without a did-not-converge message and the file unchanged.
// @evidence contracts/testing.md#independent-expectations The source is an authored, already-correct curried-arrow layout and the expectation is that same literal; nothing is computed from formatter output.
// @evidence contracts/testing.md#distinguishing-cases A single no-change case: a naive re-indent of the inner arrow body to depth times tab width from column 0 would alter it. There is no mangled-input case here, so it does not show the rule repairing a wrong chained-arrow indent.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand against a temp-dir project and JSON config; no child process, built binary or installed consumer.
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
