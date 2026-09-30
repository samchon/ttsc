package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestOverrideGlobStoredCasePreservesCharacterClass verifies that a glob's
// character class keeps its original range when a miscased Program path needs
// the spelling the tree stores. Lowercasing `[A-z]` to `[a-z]` would lose `_`,
// which the original range admits. This case runs where the volume ignores
// case; on a case-sensitive volume the miscased Program path does not exist.
//
//  1. Exercise the authored override glob stored case preserves character class fixtures through the owning Go operation.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification Glob matching distinguishes the stored character-class spelling from a path-normalization rewrite that would change its membership.
// @evidence contracts/testing.md#independent-expectations The authored character-class pattern and fixture targets determine membership independently of stored-case normalization.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for that a glob's character class keeps its original range when a miscased Program path needs the spelling the tree stores. Lowercasing `[A-z]` to `[a-z]` would lose `_`, which the original range admits. This case runs where the volume ignores case; on a case-sensitive volume the miscased Program path does not exist. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestOverrideGlobStoredCasePreservesCharacterClass owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestOverrideGlobStoredCasePreservesCharacterClass(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "src", "_directory", "index.ts"), "var x = 1;\n")
  miscased := filepath.Join(root, "SRC", "_DIRECTORY", "index.ts")
  if _, err := os.Stat(miscased); err != nil {
    t.Skip("the temporary directory distinguishes case")
  }
  if !matchAnyPattern(root, []string{"src/[A-z]directory/**"}, miscased) {
    t.Fatalf("the stored path's underscore fell out of [A-z]: %s", miscased)
  }
}
