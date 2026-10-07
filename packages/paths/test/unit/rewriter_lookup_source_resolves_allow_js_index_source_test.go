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
//
// @evidence contracts/testing.md#behavioral-verification Calls pathsLookupSource with only legacy/index.js indexed and asserts directory candidate legacy resolves to that index source.
// @evidence contracts/testing.md#independent-expectations The supported directory-index fallback includes JavaScript; the literal indexed legacy/index.js path supplies the independent expected identity.
// @evidence contracts/testing.md#distinguishing-cases Owns JavaScript-only directory-index fallback; direct JS fallback and TS priority have separate cases. Actual allowJs enrollment is outside this synthetic index test.
// @evidence contracts/testing.md#execution-ownership Unit entry TestRewriterLookupSourceResolvesAllowJSIndexSource is selected from test/unit by the utility runner unit overlay. Runs pathsLookupSource in the Go process with a synthetic source map; no source file or Program is loaded.
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
