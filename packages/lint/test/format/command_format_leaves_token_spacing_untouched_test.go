package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatLeavesTokenSpacingUntouched verifies `ttsc format` rewrites
// none of the token gaps Prettier normalizes.
//
// This pins the boundary the format guide states under "Scope": the set is a
// collection of targeted passes and none of them has the whitespace between two
// tokens as its subject. The guide and the behavior have to agree, and only a
// case can keep them agreeing. When a token-spacing pass does land, this case
// fails first, and the guide is edited with it rather than after it.
//
// The first line is missing its semicolon so the run proves the formatter was
// active. Every other line is already correct on every axis the set covers: one
// statement per line, column zero, no strings, no trailing whitespace, one
// final newline, and every node fits printWidth flat, so the reflow's fast path
// leaves each one byte-identical.
//
//  1. Seed a project with one covered defect and eight token gaps.
//  2. Run `ttsc format` with the default format block.
//  3. Assert the semicolon is added and no gap moved.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises leaves token spacing untouched and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert the semicolon is added and no gap moved.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed a project with one covered defect and eight token gaps. The asserted decision is: Assert the semicolon is added and no gap moved. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatLeavesTokenSpacingUntouched owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatLeavesTokenSpacingUntouched(t *testing.T) {
  gaps := "const a   =  1;\n" +
    "const b = 1+2;\n" +
    "const c = 1===1;\n" +
    "const i : number = 1;\n" +
    "const j = (n: number)=>n*2;\n" +
    "function run(v: number) {}\n" +
    "run (1);\n" +
    "if(x > 0) run(1);\n"
  root := seedLintProject(t, "const x = 1\n"+gaps)
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
  want := "const x = 1;\n" + gaps
  if string(got) != want {
    t.Fatalf(
      "format did not leave token spacing alone:\nwant %q\ngot  %q",
      want, string(got),
    )
  }
}
