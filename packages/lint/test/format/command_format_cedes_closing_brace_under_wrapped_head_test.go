package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatCedesClosingBraceUnderWrappedHead verifies the
// closing-brace pass cedes a `}` whose block opens on a wrapped
// continuation line — here a curried arrow whose `): void => {` head sits
// at the head's own indent, not at depth*tabWidth from column 0. The
// canonical is already correct, so `ttsc format` must be a no-op; a naive
// closing-brace re-indent would pull the `}` to column 0 and corrupt it.
//
//  1. Seed the curried-arrow canonical (already correct).
//  2. Run `ttsc format`.
//  3. Assert it converges and leaves the source unchanged.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises cedes closing brace under wrapped head and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert it converges and leaves the source unchanged.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: The canonical is already correct, so `ttsc format` must be a no-op; a naive closing-brace re-indent would pull the `}` to column 0 and corrupt it. . The asserted decision is: Assert it converges and leaves the source unchanged. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatCedesClosingBraceUnderWrappedHead owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatCedesClosingBraceUnderWrappedHead(t *testing.T) {
  canonical := "export const createHook =\n" +
    "  <T extends Function = () => any>(lifecycle: LifecycleHooks) =>\n" +
    "  (\n" +
    "    hook: T,\n" +
    "  ): void => {\n" +
    "    if (a) {\n" +
    "      injectHook(c)\n" +
    "    }\n" +
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
    t.Fatalf("wrapped-head closing brace corrupted:\ngot  %q\nwant %q", string(got), canonical)
  }
}
