package evidence

import (
  "testing"
)

/**
 * Verifies glob portability: slash normalization, case-sensitive identity, and
 * ordered exclusions behave the same on Windows and POSIX.
 *
 * Configuration commonly crosses developer and CI hosts. Normalizing separators
 * without normalizing case preserves portable spelling while keeping one true
 * path identity.
 *
 *  1. Mix backslash and slash patterns.
 *  2. Exclude a subtree and re-include one file.
 *  3. Assert separators normalize, order applies, and case does not.
 *
 * @evidence contracts/testing.md#behavioral-verification newGlobSet is compiled for `docs\**\*.md`, `!docs/private/**` and `docs/private/public.md`; matches must be true for `docs/spec.md`, `docs\nested\spec.md` and `docs/private/public.md`, false for `docs/private/secret.md`, and false for `Docs/spec.md`.
 * @evidence contracts/testing.md#independent-expectations The expected results are authored from the portability contract: backslash separators are normalized in patterns and paths, a later positive pattern re-includes a file excluded by an earlier negation, and matching stays case-sensitive.
 * @evidence contracts/testing.md#distinguishing-cases One mixed-separator set covering normalization, ordered exclusion with re-inclusion and a differently cased path in the same set; matching a path under a case-insensitive rule would flip the last assertion.
 * @evidence contracts/testing.md#execution-ownership TestGlobNormalizesSeparatorsAndAppliesOrderedExclusions is a Go unit entry in the native test process; it calls newGlobSet and matches on in-memory strings with no filesystem, consumer install or product host.
 */
func TestGlobNormalizesSeparatorsAndAppliesOrderedExclusions(t *testing.T) {
  globs, err := newGlobSet([]string{
    `docs\**\*.md`,
    `!docs/private/**`,
    `docs/private/public.md`,
  })
  if err != nil {
    t.Fatal(err)
  }
  for _, path := range []string{"docs/spec.md", `docs\nested\spec.md`, "docs/private/public.md"} {
    if !globs.matches(path) {
      t.Errorf("expected %q to be included", path)
    }
  }
  if globs.matches("docs/private/secret.md") {
    t.Fatal("excluded subtree remained selected")
  }
  if globs.matches("Docs/spec.md") {
    t.Fatal("case-insensitive match changed path identity")
  }
}
