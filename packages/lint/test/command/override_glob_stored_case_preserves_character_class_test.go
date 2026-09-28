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
