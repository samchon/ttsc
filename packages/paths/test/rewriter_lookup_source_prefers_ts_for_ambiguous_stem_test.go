package paths_test

import (
  "path/filepath"
  "testing"
)

// TestRewriterLookupSourcePrefersTSForAmbiguousStem verifies extension priority.
//
// Source files are indexed only by their exact normalized paths. When a path
// mapping target omits the extension and multiple source extensions exist,
// lookup should use the deterministic TypeScript-like extension order instead
// of a map insertion accident.
//
// 1. Build a synthetic rewriter with `ambiguous.ts`, `.tsx`, and `.js`.
// 2. Lookup the extensionless `ambiguous` stem.
// 3. Assert `.ts` wins.
func TestRewriterLookupSourcePrefersTSForAmbiguousStem(t *testing.T) {
  src := filepath.ToSlash(filepath.Join(t.TempDir(), "repo", "src"))
  rewriter := &pathsRewriter{
    sourceFiles: map[string]string{
      src + "/ambiguous.js":  src + "/ambiguous.js",
      src + "/ambiguous.ts":  src + "/ambiguous.ts",
      src + "/ambiguous.tsx": src + "/ambiguous.tsx",
    },
  }

  source, ok := pathsLookupSource(rewriter, src+"/ambiguous")
  if !ok || source != src+"/ambiguous.ts" {
    t.Fatalf("ambiguous extension lookup mismatch: source=%q ok=%v", source, ok)
  }
}
