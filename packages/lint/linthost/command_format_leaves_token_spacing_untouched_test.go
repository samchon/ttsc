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
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command with an empty format block on a file whose first line lacks a semicolon and whose following eight lines have irregular token gaps (extra spaces, `1+2`, `1===1`, `i : number`, `=>n*2`, `run (1)`, `if(x`), and requires exit 0, empty output and exactly the semicolon added with every gap unchanged.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored literal: the one covered fix plus the unchanged gap lines. It pins the documented scope that no pass owns token spacing; it is a negative expectation about current behavior, not a Prettier-parity oracle.
// @evidence contracts/testing.md#distinguishing-cases The added semicolon proves the formatter ran; the eight gap lines must stay as written. When a token-spacing pass is added, this test is intended to fail and be updated with the guide.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
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
