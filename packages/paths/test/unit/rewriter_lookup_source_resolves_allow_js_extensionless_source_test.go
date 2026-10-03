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
//
// @evidence contracts/testing.md#behavioral-verification Calls pathsLookupSource with only legacy.js indexed and asserts extensionless legacy resolves to that exact source.
// @evidence contracts/testing.md#independent-expectations Program-indexed JavaScript is eligible for extension fallback when no TS sibling exists; the literal legacy.js identity supplies the expected answer independently.
// @evidence contracts/testing.md#distinguishing-cases Owns JavaScript-only file fallback; JS index fallback, ambiguous TS priority and absent candidates have separate owners. This case does not itself enable allowJs on a Program.
// @evidence contracts/testing.md#execution-ownership Unit entry TestRewriterLookupSourceResolvesAllowJSExtensionlessSource is selected from test/unit by the utility runner unit overlay. Runs pathsLookupSource over synthetic membership in the Go process; no file is parsed or executable started.
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
