package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestOverrideGlobStoredCasePreservesCharacterClass verifies that a glob's
// character class keeps its original range when a miscased Program path needs
// the spelling the tree stores. Lowercasing `[A-z]` to `[a-z]` would lose `_`,
// which the original range admits. The negative predicate runs on every volume;
// the alias positive applies where case is ignored, while on a case-sensitive
// volume the miscased Program path does not exist.
//
//  1. Create `src/_directory/index.ts` below a base directory.
//  2. Reject `src/[a-z]directory/**` against the canonical underscore directory.
//  3. Where the alias exists, match `src/[A-z]directory/**` against `SRC/_DIRECTORY/index.ts`.
//
// @evidence contracts/testing.md#behavioral-verification matchAnyPattern must reject src/[a-z]directory/** against the canonical underscore fixture before the case-capability check. If the uppercase alias exists, src/[A-z]directory/** must match it; lowercasing the range loses underscore. Otherwise the alias case is inapplicable and the test skips after the negative assertion.
// @evidence contracts/testing.md#independent-expectations The literal underscore is outside a-z but within A-z; the fixture and authored ranges specify rejection and acceptance independently of stored-case normalization.
// @evidence contracts/testing.md#distinguishing-cases The canonical underscore directory must not match [a-z] on any volume; its existing uppercase alias must match the preserved [A-z] range on case-insensitive volumes. The neighboring miscased-import test owns the plain directory glob.
// @evidence contracts/testing.md#execution-ownership This Go unit calls matchAnyPattern on a temporary tree before checking alias availability. No host is started; an unavailable alias causes a capability skip after the negative predicate has run.
func TestOverrideGlobStoredCasePreservesCharacterClass(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "src", "_directory", "index.ts"), "var x = 1;\n")
  canonical := filepath.Join(root, "src", "_directory", "index.ts")
  if matchAnyPattern(root, []string{"src/[a-z]directory/**"}, canonical) {
    t.Fatal("the underscore directory matched a lowercase-only character class")
  }
  miscased := filepath.Join(root, "SRC", "_DIRECTORY", "index.ts")
  if _, err := os.Stat(miscased); err != nil {
    if !os.IsNotExist(err) {
      t.Fatalf("checking the miscased fixture alias: %v", err)
    }
    t.Skip("the temporary directory distinguishes case")
  }
  if !matchAnyPattern(root, []string{"src/[A-z]directory/**"}, miscased) {
    t.Fatalf("the stored path's underscore fell out of [A-z]: %s", miscased)
  }
}
