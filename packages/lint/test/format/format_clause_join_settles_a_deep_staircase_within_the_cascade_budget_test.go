package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinSettlesADeepStaircaseWithinTheCascadeBudget verifies a deeply nested chain converges inside maxFormatPasses.
//
// Hoisting contends with the nested join, so a staircase costs roughly one pass
// per level and a ten-level chain sits against the cap. Exceeding it is not a
// cosmetic miss: `ttsc format` exits 2 and the LSP path discards the whole edit
// rather than writing partial progress.
//
//  1. Seed a project with a ten-level braceless `else if` staircase.
//  2. Run `ttsc format`.
//  3. Assert it exits 0, prints nothing, and produces the flat chain.
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
