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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification resolvePopulationBase, normalizeRootPath is exercised with the scenario below; the assertions require the stored spelling and the printed label are the slashed form.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The end-to-end complementary root case declares a relative root, which is the one form where the declared spelling and the derived one coincide, so it cannot tell the stored spelling from the old derivation. The form the acceptance actually names is an absolute Windows path, and it is asserted here rather than through the rule because a path with a drive letter is absolute on one platform and relative on the other, while the spelling this stores is the same on both.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Normalize an absolute root written with backslashes. Resolve it against a project root. Assert the stored spelling and the printed label are the slashed form.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAnAbsoluteRootWithBackslashesIsStoredWithSlashes is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
