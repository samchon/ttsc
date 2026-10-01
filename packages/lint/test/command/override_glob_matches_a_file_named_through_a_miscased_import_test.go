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
// It runs wherever the temporary directory ignores case: macOS's default
// volume and Windows. On a case-sensitive volume the miscased path names no
// file, and the case does not apply.
//
//  1. Create `src/directory/index.ts` below a base directory.
//  2. Match `src/directory/**` against the file spelled `SRC/DIRECTORY/index.ts`.
//  3. Assert it matches.
// @evidence contracts/testing.md#behavioral-verification matchAnyPattern is called with the base directory, the lowercase glob src/directory/** and the miscased path SRC/DIRECTORY/index.ts of an existing file, and must report a match. The test skips itself where the temporary directory distinguishes case, so it executes only on case-insensitive volumes such as Windows and default macOS.
// @evidence contracts/testing.md#independent-expectations The literal uppercase target and lowercase authored glob define the supported case-folding expectation independently of the matcher.
// @evidence contracts/testing.md#distinguishing-cases There is a single positive case: a directory glob in lowercase against an uppercase spelling of the same existing directory. A glob that must not match a different directory is not covered, and the character-class sibling test owns the stored-case range.
// @evidence contracts/testing.md#execution-ownership Calls matchAnyPattern directly on a temporary directory tree; the miscased path exists only on case-insensitive volumes, so the test skips elsewhere, and no host is started.
func TestOverrideGlobMatchesAFileNamedThroughAMiscasedImport(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "src", "directory", "index.ts"), "var x = 1;\n")
  miscased := filepath.Join(root, "SRC", "DIRECTORY", "index.ts")
  if _, err := os.Stat(miscased); err != nil {
    t.Skip("the temporary directory distinguishes case")
  }
  if !matchAnyPattern(root, []string{"src/directory/**"}, miscased) {
    t.Fatalf("src/directory/** did not match %s", miscased)
  }
}
