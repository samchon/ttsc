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
