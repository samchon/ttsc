package evidence

import (
  "testing"
)

/**
 * Verifies directory pruning follows positive glob prefixes instead of a
 * hard-coded list of ignored folder names.
 *
 * The filesystem walk may skip a subtree only when no configured positive
 * pattern can match a file below it. Names such as `lib` and `node_modules` are
 * ordinary project-relative segments when the public config selects them.
 *
 *  1. Compile one exact subtree glob and one `**` glob.
 *  2. Check matching and impossible directory prefixes.
 *  3. Assert configured folder names remain traversable.
 * @evidence contracts/testing.md#behavioral-verification newGlobSet, scoped.couldMatchDescendant is exercised with the scenario below; the assertions require configured folder names remain traversable.
 * @evidence contracts/testing.md#independent-expectations The filesystem walk may skip a subtree only when no configured positive pattern can match a file below it. Names such as `lib` and `node_modules` are ordinary project-relative segments when the public config selects them.
 * @evidence contracts/testing.md#distinguishing-cases Compile one exact subtree glob and one `**` glob. Check matching and impossible directory prefixes. Assert configured folder names remain traversable.
 * @evidence contracts/testing.md#execution-ownership TestGlobDirectoryPruningRespectsConfiguredPrefixes is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestGlobDirectoryPruningRespectsConfiguredPrefixes(t *testing.T) {
  scoped, err := newGlobSet([]string{"lib/contracts/**"})
  if err != nil {
    t.Fatal(err)
  }
  if !scoped.couldMatchDescendant("lib") ||
    !scoped.couldMatchDescendant("lib/contracts") {
    t.Fatal("configured lib subtree was pruned")
  }
  if scoped.couldMatchDescendant("docs") ||
    scoped.couldMatchDescendant("lib/other") {
    t.Fatal("impossible subtree remained traversable")
  }

  broad, err := newGlobSet([]string{"**/*.md"})
  if err != nil {
    t.Fatal(err)
  }
  if !broad.couldMatchDescendant("node_modules/package") {
    t.Fatal("a documented ** glob was narrowed by directory name")
  }
}
