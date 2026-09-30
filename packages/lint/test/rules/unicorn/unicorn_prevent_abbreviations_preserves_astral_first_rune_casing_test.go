package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsPreservesAstralFirstRuneCasing verifies that actual casing helpers are compared with authored astral strings and the supported upper-first classification.
//
// Upstream JavaScript first-code-unit casing leaves an astral leading surrogate unchanged and uncased; the literal compatibility expectations are independent of Go Unicode helpers.
//
// @evidence contracts/testing.md#behavioral-verification Actual casing helpers are compared with authored astral strings and the supported upper-first classification.
// @evidence contracts/testing.md#independent-expectations Upstream JavaScript first-code-unit casing leaves an astral leading surrogate unchanged and uncased; the literal compatibility expectations are independent of Go Unicode helpers.
// @evidence contracts/testing.md#distinguishing-cases Upper/lower astral inputs stay unchanged and the retained astral-lower classification is true; full Unicode expansion belongs to the adjacent host.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsPreservesAstralFirstRuneCasing owns its explicit variants and named subcases where present as a discoverable Go unit entry; Direct lower-first, upper-first and starts-upper casing helper calls over authored astral strings run in the shared Go process without fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsPreservesAstralFirstRuneCasing(t *testing.T) {
  const astralUpper = "\U00010400Name"
  const astralLower = "\U00010428Name"
  if actual := lowerUnicornPreventAbbreviationsFirst(astralUpper); actual != astralUpper {
    t.Fatalf("lower-first must preserve an astral first rune: %q", actual)
  }
  if actual := upperUnicornPreventAbbreviationsFirst(astralLower); actual != astralLower {
    t.Fatalf("upper-first must preserve an astral first rune: %q", actual)
  }
  if !unicornPreventAbbreviationsStartsUpper(astralLower) {
    t.Fatal("an astral first rune must match JavaScript's upper-first classification")
  }
}
