package paths_test

import "testing"

// TestRewriterOrderPatternsKeepsDeclarationOrderOnPrefixTies verifies tie-breaking matches tsc's scan.
//
// Locks the SliceStable choice in `paths.go::orderPatterns`. tsc's
// FindBestPatternMatch takes a strictly-greater prefix to displace the
// current best, so between wildcards with equal literal prefixes the first
// declared pattern wins. An unstable sort (or a >= comparison) would resolve
// such specifiers through whichever pattern happened to land first,
// disagreeing with the type checker on order-sensitive configs.
//
// 1. Declare two wildcard patterns with identical literal prefixes, both matching one specifier.
// 2. Resolve it under both declaration orders.
// 3. Assert the first-declared pattern wins each time.
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
