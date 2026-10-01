package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPHintsStillLoadsTheProgramForADeclaredPublisher is the negative twin of
// TestLSPHintsSkipsTheProgramWhenNothingPublishes.
//
// That case proves an unloadable project answers an empty corpus when nothing
// can publish one. On its own it would also pass if the verb had stopped loading
// a Program at all, or had started swallowing every loader failure — both of
// which would silently break the corpus this verb exists to produce. Declaring a
// publisher against the same unloadable project separates those: the loader must
// be reached, and its failure must still be reported.
//
//  1. Seed a project whose lint config declares the JSDoc validator.
//  2. Run lsp-hints against a tsconfig path that does not exist.
//  3. Assert the loader failure surfaces, and as a failure rather than an empty
//     corpus with a clean exit.
// @evidence contracts/testing.md#behavioral-verification lsp-hints with a declared JSDoc publisher and nonexistent tsconfig surfaces a nonzero loader failure, distinguishing it from the empty-corpus fast path.
// @evidence contracts/testing.md#independent-expectations The deliberately absent fixture config independently determines failure; no hints output is treated as a substitute for the required loader error.
// @evidence contracts/testing.md#distinguishing-cases The same nonexistent tsconfig as the skip test is used but jsdoc/check-tag-names is enabled; the result must have nonempty stderr and a nonzero status, so a verb that stopped loading Programs or swallowed loader errors would fail. The failure text itself is not asserted.
// @evidence contracts/testing.md#execution-ownership Calls run lsp-hints in process with a nonexistent tsconfig path and captured streams so the Program loader is reached and fails; no editor or built host is started.
func TestLSPHintsStillLoadsTheProgramForADeclaredPublisher(t *testing.T) {
  root := seedLintProject(t, "/** Public value. */\nexport const value = 1;\n")
  seedLintRules(t, root, map[string]string{"jsdoc/check-tag-names": "warn"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "lsp-hints",
      "--cwd", root,
      "--tsconfig", filepath.Join(root, "no-such-tsconfig.json"),
      "--plugins-json", lintManifest(t),
    })
  })
  if stderr == "" {
    t.Fatalf("a declared publisher never reached the Program loader: stdout=%q", stdout)
  }
  if code == 0 {
    t.Fatalf("a failed Program load exited clean: stdout=%q stderr=%q", stdout, stderr)
  }
}
