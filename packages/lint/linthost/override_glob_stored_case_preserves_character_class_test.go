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
//  1. Create `src/_directory/index.ts` below a base directory.
//  2. Match `src/[A-z]directory/**` against the miscased `SRC/_DIRECTORY/index.ts`.
//  3. Assert it matches, which holds only if the glob was not lowercased.
//
// @evidence contracts/testing.md#behavioral-verification matchAnyPattern is called with the glob src/[A-z]directory/** and the miscased path SRC/_DIRECTORY/index.ts of an existing file, and must report a match; lowercasing the glob to [a-z] would exclude the underscore and fail. The test skips where the temporary directory distinguishes case, so it runs only on case-insensitive volumes.
// @evidence contracts/testing.md#independent-expectations The authored character-class pattern and fixture targets determine membership independently of stored-case normalization.
// @evidence contracts/testing.md#distinguishing-cases The single positive case uses an underscore directory name, which [A-z] admits but [a-z] does not, so only an implementation that preserves the glob's original range matches. The plain miscased directory glob is owned by the neighboring miscased-import test, and no negative glob case is included.
// @evidence contracts/testing.md#execution-ownership Calls matchAnyPattern directly on a temporary directory tree; the miscased path exists only on case-insensitive volumes, so the test skips elsewhere, and no host is started.
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
