package paths_test

import (
  "path/filepath"
  "testing"
)

// TestRewriterLookupSourceResolvesAllowJSIndexSource verifies JS index lookup.
//
// Directory-style aliases can target `./src/legacy` while the actual
// JavaScript source is `./src/legacy/index.js`. The deterministic extension
// probe must include JavaScript index files after TypeScript index files.
//
// 1. Build a synthetic rewriter with only `legacy/index.js`.
// 2. Lookup the extensionless `legacy` directory stem.
// 3. Assert the JavaScript index source is found.
func TestRewriterLookupSourceResolvesAllowJSIndexSource(t *testing.T) {
  src := filepath.ToSlash(filepath.Join(t.TempDir(), "repo", "src"))
  rewriter := &pathsRewriter{
    sourceFiles: map[string]string{
      src + "/legacy/index.js": src + "/legacy/index.js",
    },
  }

  source, ok := pathsLookupSource(rewriter, src+"/legacy")
  if !ok || source != src+"/legacy/index.js" {
    t.Fatalf("allowJs index lookup mismatch: source=%q ok=%v", source, ok)
  }
}
