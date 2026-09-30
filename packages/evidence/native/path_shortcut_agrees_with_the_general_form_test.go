package evidence

import (
  "testing"
)

/**
 * Verifies the containment shortcut answers exactly what `filepath.Rel` would.
 *
 * `relativeProjectPath` decides which files belong to a population, and it is
 * asked once per source file per configured base on every rebuild; which is
 * why a shortcut exists at all. A shortcut that answers differently from the
 * form it stands in for does not make the rule faster, it makes the population
 * different, and a file admitted or dropped there is an obligation appearing or
 * disappearing with no diagnostic to notice it.
 *
 * Case is the trap, and the shortcut's one rule is what disarms it: declining is
 * always safe, accepting is not. `filepath.Rel` compares path elements the way
 * the platform does; case-insensitively on Windows, case-sensitively
 * everywhere else; so a shortcut that folds case accepts a differently-cased
 * sibling that POSIX rejects. Comparing exactly can only ever decline early,
 * which the general form below then answers correctly on both.
 *
 * The case rows therefore agree on Windows by construction and only bite on a
 * case-sensitive filesystem. They are not redundant there; they are the reason
 * CI runs Linux and macOS.
 *
 *  1. Take roots and paths that sit below, beside, above, and beyond each other.
 *  2. Answer each through `relativeProjectPath`.
 *  3. Assert the answer matches the general form's, shortcut or not.
 * @evidence contracts/testing.md#behavioral-verification relativeProjectPath must agree in both returned path and membership flag with generalRelativeProjectPath for every named subcase. This distinguishes a shortcut that admits case-different siblings or path prefixes without a separator from the standard containment calculation.
 * @evidence contracts/testing.md#independent-expectations generalRelativeProjectPath is a test helper that calls filepath.Rel directly, rejects parent traversal, normalizes separators and trims a leading dot-slash. It does not call relativeProjectPath. Agreement verifies the shortcut against that general contract; a mistake shared by both interpretations is outside this differential oracle.
 * @evidence contracts/testing.md#distinguishing-cases The named rows cover nested and direct children, unclean and ascending segments, siblings, case-different roots and files, a sibling sharing only a string prefix, the root itself, empty root and empty path. t.Run retains each row's failure name.
 * @evidence contracts/testing.md#execution-ownership TestPathShortcutAgreesWithTheGeneralForm is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestPathShortcutAgreesWithTheGeneralForm(t *testing.T) {
  cases := []struct {
    name     string
    root     string
    absolute string
  }{
    {name: "below", root: "/repo", absolute: "/repo/src/x.ts"},
    {name: "directly below", root: "/repo", absolute: "/repo/x.ts"},
    {name: "unclean segment", root: "/repo", absolute: "/repo/./src/x.ts"},
    {name: "ascending", root: "/repo", absolute: "/repo/../other/x.ts"},
    {name: "beside", root: "/repo", absolute: "/other/x.ts"},
    {name: "case-different root", root: "/repo/API", absolute: "/repo/api/x.ts"},
    {name: "case-different file", root: "/repo", absolute: "/REPO/x.ts"},
    {name: "prefix without separator", root: "/repo", absolute: "/repository/x.ts"},
    {name: "equal", root: "/repo", absolute: "/repo"},
    {name: "empty root", root: "", absolute: "/repo/x.ts"},
    {name: "empty path", root: "/repo", absolute: ""},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      relative, ok := relativeProjectPath(test.root, test.absolute)
      wantRelative, wantOk := generalRelativeProjectPath(
        test.root,
        test.absolute,
      )
      if ok != wantOk || relative != wantRelative {
        t.Fatalf(
          "relativeProjectPath(%q, %q) = (%q, %v), general form = (%q, %v)",
          test.root,
          test.absolute,
          relative,
          ok,
          wantRelative,
          wantOk,
        )
      }
    })
  }
}
