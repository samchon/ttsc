package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatCedesClosingBraceUnderWrappedHead verifies that format
// preserves a curried arrow with a wrapped continuation head, including the
// inner if and arrow-body closing braces at their authored indentation.
//
// This fixture satisfies both wrapped-function and chained-arrow cede guards.
// Exact unchanged output rejects a de-indent, but does not independently
// establish either guard by excluding the other. No malformed input is used.
//
//  1. Seed the curried-arrow canonical (already correct).
//  2. Run `ttsc format`.
//  3. Assert it converges and leaves the source unchanged.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command (semi false) on a curried generic arrow whose `): void => {` head is wrapped, and asserts exit 0, no did-not-converge message, and the file unchanged, including the closing braces of the inner `if` and the arrow body.
// @evidence contracts/testing.md#independent-expectations The source is an authored, already-correct layout and serves as its own expected output; the expectation is not derived from the formatter.
// @evidence contracts/testing.md#distinguishing-cases One no-change curried/wrapped-head case guards both inner and body closing-brace indentation. Wrapped-function and chained-arrow guards overlap here, so this does not isolate either guard or demonstrate malformed-input repair.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand against a temp-dir project and JSON config; no child process, built binary or installed consumer.
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
