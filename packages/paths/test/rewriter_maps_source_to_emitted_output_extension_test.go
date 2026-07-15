package paths_test

import (
  "testing"
)

// TestRewriterMapsSourceToEmittedOutputExtension verifies the source-to-output
// extension matrix at outputPathForSource.
//
// The predictor must name the file TypeScript-Go actually emits or copies for a
// resolved Program source. TypeScript/JavaScript-family sources transpile to
// their runtime suffix, but copied assets (`.json` under resolveJsonModule) keep
// their extension. Pinning `.json` here proves the fix for the invented `.js`
// JSON target (#680) and the negative twins keep the established JS-family
// mappings from silently absorbing every unknown extension into `.js`.
//
// 1. Build a rewriter rooted at src → dist with jsx preserve toggled per case.
// 2. Map each source extension through outputPathForSource.
// 3. Assert copied assets keep their extension while code compiles to JS.
func TestRewriterMapsSourceToEmittedOutputExtension(t *testing.T) {
  const root = "/repo"
  const src = root + "/src"
  const out = root + "/dist"

  base := func(jsxPreserve bool) *pathsRewriter {
    return &pathsRewriter{
      basePath:    root,
      jsxPreserve: jsxPreserve,
      outDir:      out,
      rootDir:     src,
      sourceFiles: map[string]string{},
    }
  }

  cases := []struct {
    name        string
    source      string
    jsxPreserve bool
    want        string
  }{
    // Copied assets keep their own extension: the fix for #680.
    {"json commonjs asset", src + "/data.json", false, out + "/data.json"},
    {"json nested asset", src + "/config/data.json", false, out + "/config/data.json"},
    {"json double extension", src + "/data.config.json", false, out + "/data.config.json"},
    {"json uppercase preserved", src + "/DATA.JSON", false, out + "/DATA.JSON"},
    // JavaScript/TypeScript families still transpile to their runtime suffix.
    {"ts to js", src + "/main.ts", false, out + "/main.js"},
    {"tsx to js without preserve", src + "/view.tsx", false, out + "/view.js"},
    {"tsx to jsx with preserve", src + "/view.tsx", true, out + "/view.jsx"},
    {"jsx to js without preserve", src + "/view.jsx", false, out + "/view.js"},
    {"jsx to jsx with preserve", src + "/view.jsx", true, out + "/view.jsx"},
    {"js stays js", src + "/legacy.js", false, out + "/legacy.js"},
    {"mts to mjs", src + "/module.mts", false, out + "/module.mjs"},
    {"mjs stays mjs", src + "/module.mjs", false, out + "/module.mjs"},
    {"cts to cjs", src + "/module.cts", false, out + "/module.cjs"},
    {"cjs stays cjs", src + "/module.cjs", false, out + "/module.cjs"},
  }

  for _, tc := range cases {
    if got := pathsOutputPathForSource(base(tc.jsxPreserve), tc.source); got != tc.want {
      t.Fatalf("%s: outputPathForSource(%q) = %q, want %q", tc.name, tc.source, got, tc.want)
    }
  }

  // Negative twin at the extension helper: an unknown copied asset must never be
  // rewritten to a `.js` sibling that the compiler never produced.
  if got := pathsEmittedExtension("asset.json", false); got != ".json" {
    t.Fatalf("json emitted extension = %q, want .json", got)
  }
  if got := pathsEmittedExtension("asset.js", false); got != ".js" {
    t.Fatalf("js emitted extension = %q, want .js", got)
  }
}
