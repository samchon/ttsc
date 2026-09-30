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
 * @evidence contracts/testing.md#behavioral-verification newGlobSet is exercised with the scenario below; the assertions require only the project-relative form is accepted.
 * @evidence contracts/testing.md#independent-expectations `C:docs/spec.md` is not absolute according to the Windows path API, but it is still resolved against drive C rather than the project root. Accepting it would violate the project-relative contract while looking superficially safe.
 * @evidence contracts/testing.md#distinguishing-cases Compile an ordinary project-relative pattern. Compile drive-absolute and drive-relative patterns. Assert only the project-relative form is accepted.
 * @evidence contracts/testing.md#execution-ownership TestGlobRejectsWindowsDrivePaths is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
