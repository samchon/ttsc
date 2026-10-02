package evidence

import (
  "io/fs"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
)

/**
 * Verifies which declared roots each platform calls absolute.
 *
 * This is the predicate the whole repair turns on, and asserting it against the
 * resolution proves nothing, because the resolution decides by calling it. The
 * answers themselves are the contract: a rooted path carrying no volume,
 * `/srv/contracts`, is absolute on POSIX and relative on Windows, where
 * `filepath.Join` composes the project root into it, and a drive-lettered path
 * is the reverse. A predicate written from the spelling instead would invert
 * both, so the expectations are per
 * platform and the same table supplies each platform's answer without skipping one.
 *
 *  1. Ask the predicate for six spellings, with the answers this platform owes.
 *  2. Read what the resolution then did with each.
 *  3. Assert the answers are the platform's, and that the message clause about
 *     resolving against the project root follows them.
 * @evidence contracts/testing.md#behavioral-verification For six declared root spellings (`contracts`, `../contracts`, `/srv/contracts`, `C:/contracts`, `D:/` and `//server/share`) the test calls declaredRootIsAbsolute and compares it with a per-platform expected value, then checks that resolvePopulationBase joined the project root exactly when the root is relative, and that describeBaseDirectoryProblem contains `it resolves against the ttsc project root` exactly when it is relative.
 * @evidence contracts/testing.md#independent-expectations The expected answers are an authored per-platform table (a volume-less rooted path is absolute on POSIX and relative on Windows, a drive-letter path the reverse, UNC absolute on both), chosen with runtime.GOOS so each platform asserts its own contract rather than the predicate under test; the join check recomputes the join with filepath.Join as an independent check on the resolver.
 * @evidence contracts/testing.md#distinguishing-cases Relative, parent-relative, rooted-without-volume, drive-letter, drive-root and UNC spellings: the two platform-dependent forms invert between POSIX and Windows, so a predicate written from the spelling alone fails one platform. The loop iterates the map directly rather than as named subtests.
 * @evidence contracts/testing.md#execution-ownership TestEachPlatformCallsItsOwnRootsAbsolute is a Go unit entry in the native test process; it calls declaredRootIsAbsolute, resolvePopulationBase and describeBaseDirectoryProblem on string inputs and a constructed fs.PathError, with no real filesystem access, consumer install or product host.
 */
func TestEachPlatformCallsItsOwnRootsAbsolute(t *testing.T) {
  expected := map[string]bool{
    "contracts":      false,
    "../contracts":   false,
    "/srv/contracts": runtime.GOOS != "windows",
    "C:/contracts":   runtime.GOOS == "windows",
    "D:/":            runtime.GOOS == "windows",
    "//server/share": true,
  }
  project := filepath.Join(t.TempDir(), "project")
  for declared, want := range expected {
    if got := declaredRootIsAbsolute(declared); got != want {
      t.Fatalf("declaredRootIsAbsolute(%q) = %v, want %v on %s", declared, got, want, runtime.GOOS)
    }
    base := resolvePopulationBase(project, declared)
    joined := base.Absolute == filepath.Clean(
      filepath.Join(project, filepath.FromSlash(declared)),
    )
    if joined == want {
      t.Fatalf("root %q: the resolution %s the project root", declared, map[bool]string{true: "joined", false: "did not join"}[joined])
    }
    message := describeBaseDirectoryProblem(
      base,
      artifactMarkdown,
      false,
      &fs.PathError{Op: "stat", Path: base.Absolute, Err: fs.ErrNotExist},
    )
    if strings.Contains(message, "it resolves against the ttsc project root") == want {
      t.Fatalf("root %q: the clause and the answer disagree:\n%s", declared, message)
    }
  }
}
