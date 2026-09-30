package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatStructuralRulesConvergeOnNestedBlock verifies the
// cascade splits and reindents crammed statements nested two blocks deep.
//
// The headline test exercises only top-level statements, so depth-aware
// indentation is never proved end-to-end. This case crams two statements
// onto one line inside an `if` block inside a function: statement-split
// must break them and indent must carry each to depth 2 (four spaces),
// proving the shared depth walk drives both rules through nesting.
//
//  1. Seed a project with two statements crammed inside a nested block.
//  2. Run `ttsc format`.
//  3. Assert each statement lands on its own line at the depth-2 indent.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises structural rules converge on nested block and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert each statement lands on its own line at the depth-2 indent.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed a project with two statements crammed inside a nested block. The asserted decision is: Assert each statement lands on its own line at the depth-2 indent. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatStructuralRulesConvergeOnNestedBlock owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatStructuralRulesConvergeOnNestedBlock(t *testing.T) {
  source := "function f() {\n  if (x) {\n    const a = 1; const b = 2;\n  }\n}\n"
  want := "function f() {\n" +
    "  if (x) {\n" +
    "    const a = 1;\n" +
    "    const b = 2;\n" +
    "  }\n" +
    "}\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{},
  })
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
  if string(got) != want {
    t.Fatalf("nested-block cascade mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
