package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestOverrideGlobMatchesAFileNamedThroughAMiscasedImport verifies a `files` or
// `ignores` glob applies to a file the Program names through a miscased import.
//
// A Program can name a file the way an import spelled it: `./SRC/DIRECTORY`
// loads `src/directory/index.ts` as `SRC/DIRECTORY/index.ts` on a volume that
// ignores case. `matchAnyPattern` related the file to the config base through
// `filepath.EvalSymlinks`, which keeps that spelling on macOS, and matched the
// remainder against the glob case-sensitively, so `src/directory/**` missed it
// and the file was linted as if the glob did not exist (samchon/ttsc#1589).
// The remainder is now also tried as the tree stores it.
//
// The negative predicate runs on every volume. The alias positive applies
// wherever the temporary directory ignores case; on a case-sensitive volume
// the miscased path names no file and that positive case does not apply.
//
//  1. Create `src/directory/index.ts` below a base directory.
//  2. Reject a neighboring directory glob against the canonical fixture path.
//  3. Where the alias exists, match `src/directory/**` against `SRC/DIRECTORY/index.ts`.
//
// @evidence contracts/testing.md#behavioral-verification matchAnyPattern must reject src/neighbor/** against the canonical fixture before the case-capability check. If the uppercase alias exists, src/directory/** must match it; otherwise only that alias case is inapplicable and the test skips after the negative assertion.
// @evidence contracts/testing.md#independent-expectations The authored directory fixture and src/neighbor/** describe different directories; the uppercase alias and lowercase src/directory/** describe the same existing directory where case is ignored. These literal relations do not call the matcher to derive expected answers.
// @evidence contracts/testing.md#distinguishing-cases A neighboring src/neighbor/** glob must not match the canonical directory on every volume; the lowercase directory glob must match its existing uppercase alias on case-insensitive volumes. The character-class sibling owns the stored-case range.
// @evidence contracts/testing.md#execution-ownership This Go unit calls matchAnyPattern on a temporary tree before checking alias availability. No host is started; an unavailable alias causes a capability skip after the negative predicate has run.
func TestOverrideGlobMatchesAFileNamedThroughAMiscasedImport(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "src", "directory", "index.ts"), "var x = 1;\n")
  canonical := filepath.Join(root, "src", "directory", "index.ts")
  if matchAnyPattern(root, []string{"src/neighbor/**"}, canonical) {
    t.Fatal("a neighboring directory glob matched the fixture directory")
  }
  miscased := filepath.Join(root, "SRC", "DIRECTORY", "index.ts")
  if _, err := os.Stat(miscased); err != nil {
    if !os.IsNotExist(err) {
      t.Fatalf("checking the miscased fixture alias: %v", err)
    }
    t.Skip("the temporary directory distinguishes case")
  }
  if !matchAnyPattern(root, []string{"src/directory/**"}, miscased) {
    t.Fatalf("src/directory/** did not match %s", miscased)
  }
}
