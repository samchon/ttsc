package paths_test

import "testing"

// TestRewriterResolveSourcePrefersLongestPrefixPattern verifies tsc's paths precedence order.
//
// Locks the pattern ordering in `paths.go::newRewriter` to tsc's
// matchPatternOrExact contract: an exact pattern always beats a wildcard, and
// among matching wildcards the longest literal prefix wins. The previous rank
// (total literal length, prefix plus suffix) steered "@app/foo-styles" at the
// "*-styles" pattern even though tsc resolves it through "@app/*", so the
// rewriter pointed imports at a different module than the type checker had
// resolved.
//
// 1. Configure overlapping exact, long-prefix, and long-suffix patterns.
// 2. Resolve specifiers that match more than one of them.
// 3. Assert each resolution follows the exact-first, longest-prefix order.
//
// @evidence contracts/testing.md#behavioral-verification Orders exact, @app/* and *-styles patterns and asserts long-prefix selection for @app/foo-styles, exact selection for @app/main and suffix-only success for bar-styles.
// @evidence contracts/testing.md#independent-expectations TypeScript matchPatternOrExact prioritizes exact keys and compares wildcard literal prefixes rather than total prefix/suffix length; distinct literal targets expose the wrong ranking.
// @evidence contracts/testing.md#distinguishing-cases Owns competing prefix/suffix match, exact/wildcard overlap and suffix-only success; equal-prefix ties and failed-best commitment have separate cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestRewriterResolveSourcePrefersLongestPrefixPattern is selected from test/unit by the utility runner unit overlay. Runs pathsOrderPatterns and pathsResolveSource on synthetic maps in the Go process; checker/program assembly and real alias connections remain boundary coverage.
func TestRewriterResolveSourcePrefersLongestPrefixPattern(t *testing.T) {
  root := "/repo"
  patterns := []pathsPathPattern{
    {pattern: "*-styles", targets: []string{"src/styles/*"}},
    {pattern: "@app/*", targets: []string{"src/app/*"}},
    {pattern: "@app/main", targets: []string{"src/entry.ts"}},
  }
  pathsOrderPatterns(patterns)
  rewriter := &pathsRewriter{
    basePath: root,
    patterns: patterns,
    sourceFiles: map[string]string{
      root + "/src/styles/@app/foo.ts": root + "/src/styles/@app/foo.ts",
      root + "/src/styles/bar.ts":      root + "/src/styles/bar.ts",
      root + "/src/app/foo-styles.ts":  root + "/src/app/foo-styles.ts",
      root + "/src/app/main.ts":        root + "/src/app/main.ts",
      root + "/src/entry.ts":           root + "/src/entry.ts",
    },
  }
  if source, ok := pathsResolveSource(rewriter, "@app/foo-styles"); !ok || source != root+"/src/app/foo-styles.ts" {
    t.Fatalf("longest-prefix pattern mismatch: source=%q ok=%v", source, ok)
  }
  if source, ok := pathsResolveSource(rewriter, "@app/main"); !ok || source != root+"/src/entry.ts" {
    t.Fatalf("exact-over-wildcard mismatch: source=%q ok=%v", source, ok)
  }
  if source, ok := pathsResolveSource(rewriter, "bar-styles"); !ok || source != root+"/src/styles/bar.ts" {
    t.Fatalf("suffix pattern fallback mismatch: source=%q ok=%v", source, ok)
  }
}
