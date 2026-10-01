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
 * @evidence contracts/testing.md#behavioral-verification newGlobSet is built for `lib/contracts/**` and `**\/*.md`; couldMatchDescendant must be true for `lib` and `lib/contracts` and false for `docs` and `lib/other` on the first set, and true for `node_modules/package` on the second.
 * @evidence contracts/testing.md#independent-expectations The expected answers are authored from the pruning contract: a subtree may be skipped only when no configured positive pattern can match below it, and folder names such as `lib` or `node_modules` are ordinary segments when a pattern selects them.
 * @evidence contracts/testing.md#distinguishing-cases A scoped prefix glob (matching and impossible directories) against a leading `**` glob that must keep every directory, including one named node_modules; the pruning behavior for negated patterns is owned by sibling glob entries.
 * @evidence contracts/testing.md#execution-ownership TestGlobDirectoryPruningRespectsConfiguredPrefixes is a Go unit entry in the native test process; it calls newGlobSet and couldMatchDescendant on in-memory strings with no filesystem, consumer install or product host.
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
