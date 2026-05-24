package paths_test

import (
  "path/filepath"
  "testing"
)

// TestRewriterLookupSourceResolvesAllowJSExtensionlessSource verifies JS source lookup.
//
// Projects with `allowJs` can place JavaScript files in the Program's source
// file list. A paths target such as `./src/legacy` still omits the extension,
// so lookup must probe JavaScript source extensions after the TypeScript
// extensions instead of silently leaving the alias unresolved.
//
// 1. Build a synthetic rewriter with only `legacy.js` in the source index.
// 2. Lookup the extensionless `legacy` stem.
// 3. Assert the JavaScript source is found.
func TestRewriterLookupSourceResolvesAllowJSExtensionlessSource(t *testing.T) {
  src := filepath.ToSlash(filepath.Join(t.TempDir(), "repo", "src"))
  rewriter := &pathsRewriter{
    sourceFiles: map[string]string{
      src + "/legacy.js": src + "/legacy.js",
    },
  }

  source, ok := pathsLookupSource(rewriter, src+"/legacy")
  if !ok || source != src+"/legacy.js" {
    t.Fatalf("allowJs extensionless lookup mismatch: source=%q ok=%v", source, ok)
  }
}
