package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinSettlesADeepStaircaseWithinTheCascadeBudget verifies a deeply nested chain converges inside maxFormatPasses.
//
// Hoisting contends with the nested join, so nine conditions and their final
// alternate must reach a flat fixed point within the cascade limit. The output
// assertion does not measure a pass count. Exceeding the limit makes format
// fail rather than accepting partial convergence.
//
//  1. Seed a project with nine nested conditions and a final alternate.
//  2. Run `ttsc format`.
//  3. Assert it exits 0, prints nothing, and produces the flat chain.
//
// @evidence contracts/testing.md#behavioral-verification The direct format entry must converge a nine-condition staircase and final alternate to the complete flat chain, exit zero and keep both streams empty. The literal file assertion detects partial convergence or lost branches; it does not measure the number of passes.
// @evidence contracts/testing.md#independent-expectations The supported canonical else-if layout independently determines each header and call line. The expected a-through-i conditions and x1-through-x10 calls retain their order and identity rather than being generated from cascade state.
// @evidence contracts/testing.md#distinguishing-cases This positive combines nine if conditions with a final else across deeply overlapping hoists. The simpler chain and nested-function hosts cover shallower and nonzero-column forms; this host does not prove convergence for arbitrary nesting depth.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinSettlesADeepStaircaseWithinTheCascadeBudget owns its complete fixture and direct run(format) status/stream/file assertions in the public Go unit population. Its cascade runs in the same process with no consumer installation, native artifact production or child host.
func TestFormatClauseJoinSettlesADeepStaircaseWithinTheCascadeBudget(t *testing.T) {
  root := seedLintProject(t, "if (a)\n  x1();\nelse\n  if (b)\n    x2();\n  else\n    if (c)\n      x3();\n    else\n      if (d)\n        x4();\n      else\n        if (e)\n          x5();\n        else\n          if (f)\n            x6();\n          else\n            if (g)\n              x7();\n            else\n              if (h)\n                x8();\n              else\n                if (i)\n                  x9();\n                else\n                  x10();\n")
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
  if want := "if (a) x1();\nelse if (b) x2();\nelse if (c) x3();\nelse if (d) x4();\nelse if (e) x5();\nelse if (f) x6();\nelse if (g) x7();\nelse if (h) x8();\nelse if (i) x9();\nelse x10();\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
