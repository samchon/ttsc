package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies an absolute root written with backslashes is stored and named in one
 * slash-separated form.
 *
 * The end-to-end complementary root case declares a relative root, which is the one form
 * where the declared spelling and the derived one coincide, so it cannot tell
 * the stored spelling from the old derivation. The form the acceptance actually
 * names is an absolute Windows path, and it is asserted here rather than through
 * the rule because a path with a drive letter is absolute on one platform and
 * relative on the other, while the spelling this stores is the same on both.
 *
 *  1. Normalize an absolute root written with backslashes.
 *  2. Resolve it against a project root.
 *  3. Assert the stored spelling and the printed label are the slashed form.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizeRootPath is called on `C:\contracts` and must return `C:/contracts` with no problem; resolvePopulationBase for a temp project and that value must record Declared `C:/contracts`, and populationRootLabel of it must be `C:/contracts`.
 * @evidence contracts/testing.md#independent-expectations The expected strings are authored literals; the path is handled as a string by the normalizer, so the result is the same on POSIX and Windows even though a drive-letter path is absolute on only one of them.
 * @evidence contracts/testing.md#distinguishing-cases One Windows-style absolute spelling checked at three stages (normalized, stored, printed label); a root written with slashes or a relative backslash root is owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestAnAbsoluteRootWithBackslashesIsStoredWithSlashes is a Go unit entry in the native test process; it calls the normalizer, base resolver and label function on literals with no filesystem access, consumer install or product host.
 */
func TestAnAbsoluteRootWithBackslashesIsStoredWithSlashes(t *testing.T) {
  normalized, problem := normalizeRootPath(`C:\contracts`)
  if problem != "" {
    t.Fatalf("an absolute Windows root is accepted, got: %s", problem)
  }
  if normalized != "C:/contracts" {
    t.Fatalf("normalized = %q, want %q", normalized, "C:/contracts")
  }
  base := resolvePopulationBase(filepath.Join(t.TempDir(), "project"), normalized)
  if base.Declared != "C:/contracts" {
    t.Fatalf("declared = %q, want %q", base.Declared, "C:/contracts")
  }
  if label := populationRootLabel(base); label != "C:/contracts" {
    t.Fatalf("label = %q, want %q", label, "C:/contracts")
  }
}
