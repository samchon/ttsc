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
