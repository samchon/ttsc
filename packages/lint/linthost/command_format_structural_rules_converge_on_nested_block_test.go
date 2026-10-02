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
// indentation is not observed there. This case crams two statements
// onto one line inside an `if` block inside a function: statement-split
// must break them and indent must carry each to depth 2 (four spaces),
// checking their final composition through the in-process command. It does
// not inspect individual edit provenance or an installed consumer.
//
//  1. Seed a project with two statements crammed inside a nested block.
//  2. Run `ttsc format`.
//  3. Assert each statement lands on its own line at the depth-2 indent.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on a function with an `if` block whose body crams `const a = 1; const b = 2;` on one line, and requires exit 0, empty output and the exact file with each statement on its own line at four spaces.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored literal with depth-2 indentation; it is not derived from the formatter.
// @evidence contracts/testing.md#distinguishing-cases One input that must change at nesting depth 2, distinguishing a split that places both statements correctly from one that leaves them at the wrong depth or on one line; the top-level case is owned by the headline test.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
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
