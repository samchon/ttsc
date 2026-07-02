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
