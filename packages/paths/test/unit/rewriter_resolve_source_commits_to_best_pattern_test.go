package paths_test

import "testing"

// TestRewriterResolveSourceCommitsToBestPattern verifies no fall-through past the matched pattern.
//
// Locks `paths.go::resolveSource` to tsc's tryLoadModuleUsingPaths contract:
// resolution commits to the single best-precedence matching pattern and tries
// only that pattern's substitution targets. When none of them names a program
// source, tsc's paths lookup fails — it never consults a weaker pattern — so
// falling through here would rewrite the import at a module the type checker
// never resolved.
//
// 1. Configure a long-prefix pattern whose target is missing and a catch-all whose target exists.
// 2. Resolve a specifier that matches both.
// 3. Assert resolution fails instead of landing on the catch-all's source.
//
// @evidence contracts/testing.md#behavioral-verification Orders @app/* and catch-all patterns, then asserts @app/widget fails despite an available catch-all source; other still resolves through the catch-all.
// @evidence contracts/testing.md#independent-expectations TypeScript paths lookup commits to the best matching pattern instead of weaker fallthrough; a deliberately present wrong target distinguishes that failure.
// @evidence contracts/testing.md#distinguishing-cases Owns missing-best-target rejection and catch-all success without a more-specific match; successful precedence and within-pattern target fallback have separate owners.
// @evidence contracts/testing.md#execution-ownership Unit entry TestRewriterResolveSourceCommitsToBestPattern is selected from test/unit by the utility runner unit overlay. Runs pathsOrderPatterns and pathsResolveSource with synthetic sources in the Go process; no checker or filesystem resolution is invoked.
func TestRewriterResolveSourceCommitsToBestPattern(t *testing.T) {
  root := "/repo"
  patterns := []pathsPathPattern{
    {pattern: "*", targets: []string{"src/anywhere/*"}},
    {pattern: "@app/*", targets: []string{"src/app/*"}},
  }
  pathsOrderPatterns(patterns)
  rewriter := &pathsRewriter{
    basePath: root,
    patterns: patterns,
    sourceFiles: map[string]string{
      root + "/src/anywhere/@app/widget.ts": root + "/src/anywhere/@app/widget.ts",
      root + "/src/anywhere/other.ts":       root + "/src/anywhere/other.ts",
    },
  }
  if source, ok := pathsResolveSource(rewriter, "@app/widget"); ok {
    t.Fatalf("resolution fell through past the best pattern to %q", source)
  }
  if source, ok := pathsResolveSource(rewriter, "other"); !ok || source != root+"/src/anywhere/other.ts" {
    t.Fatalf("catch-all pattern mismatch: source=%q ok=%v", source, ok)
  }
}
