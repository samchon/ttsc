package paths_test

import "testing"

// TestRewriterOrderPatternsKeepsDeclarationOrderOnPrefixTies verifies tie-breaking matches tsc's scan.
//
// Locks the tie outcome of `paths.go::orderPatterns`. tsc's
// FindBestPatternMatch takes a strictly-greater prefix to displace the
// current best, so between wildcards with equal literal prefixes the first
// declared pattern wins. A >= comparison or a suffix-based rank would resolve
// such specifiers through the later pattern, disagreeing with the type
// checker on order-sensitive configs. With two patterns an unstable sort would
// also pass, so stability itself is owned by
// TestRewriterOrderPatternsKeepsDeclarationOrderWithinEqualRanks.
//
// 1. Declare two wildcard patterns with identical literal prefixes, both matching one specifier.
// 2. Resolve it under both declaration orders.
// 3. Assert the first-declared pattern wins each time.
//
// @evidence contracts/testing.md#behavioral-verification Sorts equal-prefix suffixed/open patterns in both declaration orders and asserts @a/zx resolves to the first declared target each time.
// @evidence contracts/testing.md#independent-expectations TypeScript paths ties retain the first declaration when literal prefix lengths match; two distinct target paths expose a greater-or-equal comparison or a suffix-ranked ordering that would swap the two entries. With only two patterns the case cannot separate a stable sort from an unstable one, because short inputs are insertion-sorted either way.
// @evidence contracts/testing.md#distinguishing-cases Owns both permutations of a successful equal-prefix tie; exact priority and unequal-prefix ranking are covered by TestRewriterResolveSourcePrefersLongestPrefixPattern.
// @evidence contracts/testing.md#execution-ownership Unit entry TestRewriterOrderPatternsKeepsDeclarationOrderOnPrefixTies is selected from test/unit by the utility runner unit overlay. Runs pathsOrderPatterns and pathsResolveSource on copied pattern slices and synthetic maps in the Go process; each iteration owns its ordering and no Program is loaded.
func TestRewriterOrderPatternsKeepsDeclarationOrderOnPrefixTies(t *testing.T) {
  root := "/repo"
  sources := map[string]string{
    root + "/src/tie/x/z.ts":    root + "/src/tie/x/z.ts",
    root + "/src/tie/all/zx.ts": root + "/src/tie/all/zx.ts",
  }
  suffixed := pathsPathPattern{pattern: "@a/*x", targets: []string{"src/tie/x/*"}}
  open := pathsPathPattern{pattern: "@a/*", targets: []string{"src/tie/all/*"}}

  for _, c := range []struct {
    name     string
    patterns []pathsPathPattern
    expected string
  }{
    {"suffixed declared first", []pathsPathPattern{suffixed, open}, root + "/src/tie/x/z.ts"},
    {"open declared first", []pathsPathPattern{open, suffixed}, root + "/src/tie/all/zx.ts"},
  } {
    patterns := append([]pathsPathPattern(nil), c.patterns...)
    pathsOrderPatterns(patterns)
    rewriter := &pathsRewriter{basePath: root, patterns: patterns, sourceFiles: sources}
    if source, ok := pathsResolveSource(rewriter, "@a/zx"); !ok || source != c.expected {
      t.Fatalf("%s: tie resolution mismatch: source=%q ok=%v expected=%q", c.name, source, ok, c.expected)
    }
  }
}
