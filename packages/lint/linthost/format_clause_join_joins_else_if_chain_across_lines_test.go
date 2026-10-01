package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinJoinsElseIfChainAcrossLines verifies an `else` whose alternate is an `if` collapses the whole chain.
//
// Prettier prints an `else if` chain flat, so the alternate being an `if` is
// exempt from the single-line-body guard. Hoisting it also moves its
// continuation lines, and the inner join then contends for the same bytes, so
// the chain must settle through the cascade. The command is the
// level that contract lives at, and `ttsc format` runs the cascade to a fixed
// point.
//
//  1. Seed a project with an `else` whose alternate is an `if` across two lines.
//  2. Run `ttsc format`.
//  3. Assert the chain collapses to `else if (b) y();`.
//
// @evidence contracts/testing.md#behavioral-verification The direct format entry must reach a flat else-if chain with both short calls joined. Exact status, quiet streams and complete file output catch a cascade that leaves a partial hoist or drops a nested join.
// @evidence contracts/testing.md#independent-expectations The literal flat if/else-if form is the supported canonical layout, preserving both predicates and calls. The oracle asserts the final source rather than deriving a pass count from implementation scheduling.
// @evidence contracts/testing.md#distinguishing-cases The alternate is itself an if spanning lines, so it must bypass the ordinary single-line-body restriction. ReindentsAHoistedElseIfChain adds a trailing alternate and the deep-staircase host tests deeper convergence.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinJoinsElseIfChainAcrossLines owns the real fixture, config, direct run(format) invocation and status/stream/file assertions in the public Go unit population. Its cascade stays in the same process and launches no consumer installation, native artifact builder or child host.
func TestFormatClauseJoinJoinsElseIfChainAcrossLines(t *testing.T) {
  root := seedLintProject(t, "if (a)\n  x();\nelse\n  if (b)\n    y();\n")
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
  if want := "if (a) x();\nelse if (b) y();\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
