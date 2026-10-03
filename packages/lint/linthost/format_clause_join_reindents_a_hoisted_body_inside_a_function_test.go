package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinReindentsAHoistedBodyInsideAFunction verifies the completed command retains a nonzero enclosing column.
//
// Nesting the chain inside a function requires its final headers to retain the
// enclosing two-space indentation. The full output observes that destination,
// not an individual rule's delta or whether another pass repaired an edit.
//
//  1. Seed a project with an `else if` chain nested inside a function body.
//  2. Run `ttsc format`.
//  3. Assert the chain lands at the function body's column, not at zero.
//
// @evidence contracts/testing.md#behavioral-verification The direct formatter must flatten a nested else-if chain while keeping all branches inside the function at two-space indentation. Full file, status and stream assertions reject a completed command that leaves those headers at column zero.
// @evidence contracts/testing.md#independent-expectations The literal supported function/block layout establishes the enclosing two-space column, and both conditions and calls are unchanged. Expected indentation is authored independently of the rule delta computation.
// @evidence contracts/testing.md#distinguishing-cases This positive nests the hoisted chain inside a function so its final header column is nonzero, unlike the top-level chain. It does not isolate intermediate reindent arithmetic or repair scheduling.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinReindentsAHoistedBodyInsideAFunction owns its fixture, direct run(format) call and observable file/status/stream assertions in the public Go unit population. There is no consumer install, native artifact production or child product host.
func TestFormatClauseJoinReindentsAHoistedBodyInsideAFunction(t *testing.T) {
  root := seedLintProject(t, "function f() {\n  if (a)\n    x();\n  else\n    if (b)\n      y();\n}\n")
  seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if want := "function f() {\n  if (a) x();\n  else if (b) y();\n}\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
