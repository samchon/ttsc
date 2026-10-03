package evidence

import (
  "io/fs"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
)

/**
 * Verifies the resolved path is restated exactly where it says something new.
 *
 * Two questions used one predicate. Whether to print the resolved path again is
 * decided by whether it differs from the label; whether the project root was
 * composed into the spelling is what gates the clause that says so. They agree
 * for every shape but one: a UNC root on POSIX is absolute, so the predicate
 * suppressed the restatement, while `filepath.Clean` collapses its leading
 * slashes and the two spellings genuinely differ.
 *
 * Both bases are built rather than resolved, because the collapsing shape exists
 * on POSIX only and the rule has to hold on both. The root that lands on itself
 * is spelled the way each platform calls absolute, or the negative twin would
 * exercise nothing on one of them.
 *
 *  1. Build a base whose declared spelling and resolved path differ while the
 *     declared one is absolute.
 *  2. Render both messages that restate a path.
 *  3. Assert each restates it, and that an absolute root landing on itself does
 *     not.
 *
 * @evidence contracts/testing.md#behavioral-verification describeBaseDirectoryProblem and unresolvedBaseProblem are called on a hand-built populationBase with Declared `//server/share` and Absolute `/server/share`, each message must contain `which resolves to '/server/share'`; the same two functions on a base whose declared and absolute spellings are the same platform-absolute path (`/srv/contracts`, or `C:/contracts` on Windows) must not contain `which resolves to`.
 * @evidence contracts/testing.md#independent-expectations The expected substrings are authored literals following the message contract that a resolved path is restated only when it differs from the declared spelling; the bases are constructed by hand, so the expectation does not depend on filepath resolution of the host platform.
 * @evidence contracts/testing.md#distinguishing-cases A positive pair (a spelling the resolution collapsed, which must be restated in both messages) against a negative pair (a root that lands on itself, which must not be restated); the platform-specific self-landing spelling keeps the negative case meaningful on both POSIX and Windows.
 * @evidence contracts/testing.md#execution-ownership TestAResolvedPathIsRestatedOnlyWhereItDiffers is a Go unit entry in the native test process; it calls the two message builders directly on in-memory bases and fs.PathError values with no filesystem access, consumer install or product host.
 */
func TestAResolvedPathIsRestatedOnlyWhereItDiffers(t *testing.T) {
  collapsed := populationBase{Declared: "//server/share", Absolute: "/server/share"}
  for _, message := range []string{
    describeBaseDirectoryProblem(
      collapsed,
      artifactMarkdown,
      false,
      &fs.PathError{Op: "stat", Path: collapsed.Absolute, Err: fs.ErrNotExist},
    ),
    unresolvedBaseProblem(collapsed, artifactMarkdown),
  } {
    if !strings.Contains(message, "which resolves to '/server/share'") {
      t.Fatalf("a spelling the resolution changed is restated:\n%s", message)
    }
  }
  onItself := "/srv/contracts"
  if runtime.GOOS == "windows" {
    onItself = "C:/contracts"
  }
  landed := populationBase{Declared: onItself, Absolute: filepath.FromSlash(onItself)}
  for _, message := range []string{
    describeBaseDirectoryProblem(
      landed,
      artifactMarkdown,
      false,
      &fs.PathError{Op: "stat", Path: landed.Absolute, Err: fs.ErrNotExist},
    ),
    unresolvedBaseProblem(landed, artifactMarkdown),
  } {
    if strings.Contains(message, "which resolves to") {
      t.Fatalf("a root that landed on itself is not named twice:\n%s", message)
    }
  }
}
