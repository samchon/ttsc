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
//
// @evidence contracts/testing.md#behavioral-verification Calls pathsLookupSource with ambiguous.ts, .tsx and .js all indexed and asserts extensionless ambiguous resolves to .ts.
// @evidence contracts/testing.md#independent-expectations The supported extension probe order prefers .ts before .tsx and .js; the literal .ts source is the independently selected expected winner.
// @evidence contracts/testing.md#distinguishing-cases Owns successful extension precedence among three competing kinds; missing lookup and JavaScript-only fallback have separate cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestRewriterLookupSourcePrefersTSForAmbiguousStem is selected from test/unit by the utility runner unit overlay. Runs pathsLookupSource on a synthetic source map in the Go process; no source files, allowJs compiler options or Program are loaded.
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
