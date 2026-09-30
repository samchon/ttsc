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
 * both, which is the defect this cycle removed, so the expectations are per
 * platform and the same table supplies each platform's answer without skipping one.
 *
 *  1. Ask the predicate for six spellings, with the answers this platform owes.
 *  2. Read what the resolution then did with each.
 *  3. Assert the answers are the platform's, and that the message clause about
 *     resolving against the project root follows them.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification describeBaseDirectoryProblem, resolvePopulationBase, declaredRootIsAbsolute is exercised with the scenario below; the assertions require the answers are the platform's, and that the message clause about resolving against the project root follows them.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is the predicate the whole repair turns on, and asserting it against the resolution proves nothing, because the resolution decides by calling it. The answers themselves are the contract: a rooted path carrying no volume, `/srv/contracts`, is absolute on POSIX and relative on Windows, where `filepath.Join` composes the project root into it, and a drive-lettered path is the reverse. A predicate written from the spelling instead would invert both, which is the defect this cycle removed, so the expectations are per platform and the same table supplies each platform's answer without skipping one.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Ask the predicate for six spellings, with the answers this platform owes. Read what the resolution then did with each. Assert the answers are the platform's, and that the message clause about resolving against the project root follows them.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestEachPlatformCallsItsOwnRootsAbsolute is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
