package evidence

import (
  "testing"
)

/**
 * Verifies files patterns reject every Windows path form that carries a drive
 * identity, including drive-relative paths.
 *
 * `C:docs/spec.md` is not absolute according to the Windows path API, but it is
 * still resolved against drive C rather than the project root. Accepting it
 * would violate the project-relative contract while looking superficially safe.
 *
 *  1. Compile an ordinary project-relative pattern.
 *  2. Compile drive-absolute and drive-relative patterns.
 *  3. Assert only the project-relative form is accepted.
 * @evidence contracts/testing.md#behavioral-verification newGlobSet must accept `docs/**\/*.md` and must return an error for `C:\docs\**\*.md` and `C:docs\**\*.md`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the project-relative contract: a drive-letter path, including the drive-relative `C:docs`, resolves against a drive rather than the project root and must be refused wherever the test runs.
 * @evidence contracts/testing.md#distinguishing-cases A drive-absolute and a drive-relative spelling against an ordinary relative pattern; only the presence of an error is asserted, not its wording.
 * @evidence contracts/testing.md#execution-ownership TestGlobRejectsWindowsDrivePaths is a Go unit entry in the native test process; it calls newGlobSet on in-memory strings with no filesystem, consumer install or product host.
 */
func TestGlobRejectsWindowsDrivePaths(t *testing.T) {
  if _, err := newGlobSet([]string{"docs/**/*.md"}); err != nil {
    t.Fatalf("project-relative glob was rejected: %v", err)
  }
  for _, pattern := range []string{`C:\docs\**\*.md`, `C:docs\**\*.md`} {
    if _, err := newGlobSet([]string{pattern}); err == nil {
      t.Fatalf("drive path %q was accepted", pattern)
    }
  }
}
