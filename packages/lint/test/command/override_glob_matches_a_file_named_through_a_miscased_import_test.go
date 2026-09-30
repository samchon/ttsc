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
// @evidence contracts/testing.md#behavioral-verification overrideGlobMatches compares a stored directory glob with a miscased spelling of its fixture source and must match on the intended platform branch.
// @evidence contracts/testing.md#independent-expectations The literal uppercase target and lowercase authored glob define the supported case-folding expectation independently of the matcher.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Create `src/directory/index.ts` below a base directory. The asserted decision is: Assert it matches. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestOverrideGlobMatchesAFileNamedThroughAMiscasedImport owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
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
