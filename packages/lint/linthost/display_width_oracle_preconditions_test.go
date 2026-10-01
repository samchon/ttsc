package linthost

import "testing"

// assertDisplayWidthOraclePreconditions checks the range-table invariants
// required by binary-search width measurement before the behavioral oracle
// corpus runs. These are prerequisites, not a comparison with an installed
// Prettier version. The caller owns the actual width assertions.
func assertDisplayWidthOraclePreconditions(t *testing.T) {
  t.Helper()
  if len(prettierWideRanges) == 0 || len(prettierFullWidthRanges) == 0 {
    t.Fatal("width tables are empty, so every character would measure one column")
  }
  if len(prettierNarrowEmojiRanges) == 0 {
    t.Fatal("narrow-emoji table is empty, so every emoji would measure two columns")
  }
  // Sorted and disjoint, which is what the binary search assumes.
  for name, ranges := range map[string][]unicodeRange{
    "wide":         prettierWideRanges[:],
    "fullwidth":    prettierFullWidthRanges[:],
    "narrow-emoji": prettierNarrowEmojiRanges[:],
  } {
    for i, r := range ranges {
      if r.lo > r.hi {
        t.Fatalf("%s range %d is descending: %04X..%04X", name, i, r.lo, r.hi)
      }
      if i > 0 && r.lo <= ranges[i-1].hi {
        t.Fatalf("%s ranges %d and %d overlap", name, i-1, i)
      }
    }
  }
}
