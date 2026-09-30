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
 * @evidence contracts/testing.md#behavioral-verification newGlobSet, globs.matches is exercised with the scenario below; the assertions require separators normalize, order applies, and case does not.
 * @evidence contracts/testing.md#independent-expectations Configuration commonly crosses developer and CI hosts. Normalizing separators without normalizing case preserves portable spelling while keeping one true path identity.
 * @evidence contracts/testing.md#distinguishing-cases Mix backslash and slash patterns. Exclude a subtree and re-include one file. Assert separators normalize, order applies, and case does not.
 * @evidence contracts/testing.md#execution-ownership TestGlobNormalizesSeparatorsAndAppliesOrderedExclusions is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
