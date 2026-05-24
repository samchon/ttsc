package paths_test

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRewriterHelpersCoverResolutionEdges verifies path matching and output math.
//
// Command tests prove the sidecar rewrites real source text. These pure helper
// checks pin the resolver edge cases that are difficult to force through a
// single TypeScript fixture: exact patterns, extension fallbacks, index files,
// out-of-root sources, and empty path configuration.
//
// 1. Build a synthetic rewriter with exact, wildcard, fallback, and index targets.
// 2. Exercise source lookup, rewrite decisions, emitted extensions, and path helpers.
// 3. Assert unresolved aliases and unsafe relative outputs are left unchanged.
func TestRewriterHelpersCoverResolutionEdges(t *testing.T) {
  if r := pathsNewRewriter(nil); r == nil || len(r.sourceFiles) != 0 {
    t.Fatalf("nil program rewriter mismatch: %#v", r)
  }
  pathsApply(nil, nil)
  pathsApply(&pathsRewriter{}, nil)
  pathsVisitModuleSpecifiers(nil, func(*shimast.Node) {
    t.Fatal("nil node should not be visited")
  })
  if pathsIsModuleSpecifierCall(nil) {
    t.Fatal("nil call should not be a module specifier call")
  }

  root := filepath.ToSlash(filepath.Join(t.TempDir(), "repo"))
  src := root + "/src"
  out := root + "/dist"
  rewriter := &pathsRewriter{
    basePath: root,
    outDir:   out,
    rootDir:  src,
    patterns: []pathsPathPattern{
      {pattern: "@exact", targets: []string{"src/exact.ts"}},
      {pattern: "@lib/*", targets: []string{"src/lib/*"}},
      {pattern: "@fallback/*", targets: []string{"missing/*", "src/lib/*"}},
      {pattern: "@pkg/*", targets: []string{"src/pkg/*"}},
    },
    sourceFiles: map[string]string{
      src + "/main.ts":           src + "/main.ts",
      src + "/extra.ts":          src + "/extra.ts",
      src + "/lib/message.ts":    src + "/lib/message.ts",
      src + "/exact.ts":          src + "/exact.ts",
      src + "/pkg/tool/index.ts": src + "/pkg/tool/index.ts",
      root + "/outside.ts":       root + "/outside.ts",
    },
  }

  if source, ok := pathsResolveSource(rewriter, "@exact"); !ok || source != src+"/exact.ts" {
    t.Fatalf("exact source mismatch: source=%q ok=%v", source, ok)
  }
  if source, ok := pathsResolveSource(rewriter, "@fallback/message"); !ok || source != src+"/lib/message.ts" {
    t.Fatalf("fallback source mismatch: source=%q ok=%v", source, ok)
  }
  if source, ok := pathsResolveSource(rewriter, "@pkg/tool"); !ok || source != src+"/pkg/tool/index.ts" {
    t.Fatalf("index source mismatch: source=%q ok=%v", source, ok)
  }
  if _, ok := pathsResolveSource(rewriter, "@missing/value"); ok {
    t.Fatal("unexpected missing source resolution")
  }
  if source, ok := pathsLookupSource(rewriter, src+"/lib/message.js"); !ok || source != src+"/lib/message.ts" {
    t.Fatalf("extension lookup mismatch: source=%q ok=%v", source, ok)
  }
  if source, ok := pathsLookupSource(rewriter, src+"/extra"); !ok || source != src+"/extra.ts" {
    t.Fatalf("source extension lookup mismatch: source=%q ok=%v", source, ok)
  }
  if source, ok := pathsLookupSource(rewriter, src+"/pkg/tool"); !ok || source != src+"/pkg/tool/index.ts" {
    t.Fatalf("index lookup mismatch: source=%q ok=%v", source, ok)
  }
  if _, ok := pathsLookupSource(rewriter, src+"/none"); ok {
    t.Fatal("unexpected lookup success")
  }

  if rewritten, ok := pathsRewrite(rewriter, src+"/main.ts", "@lib/message"); !ok || rewritten != "./lib/message.js" {
    t.Fatalf("same-dir rewrite mismatch: rewritten=%q ok=%v", rewritten, ok)
  }
  if rewritten, ok := pathsRewrite(rewriter, src+"/lib/message.ts", "@exact"); !ok || rewritten != "../exact.js" {
    t.Fatalf("parent rewrite mismatch: rewritten=%q ok=%v", rewritten, ok)
  }
  for _, specifier := range []string{"", "./local", "../up", "/absolute", "@missing/value"} {
    if rewritten, ok := pathsRewrite(rewriter, src+"/main.ts", specifier); ok || rewritten != specifier {
      t.Fatalf("unexpected rewrite for %q: rewritten=%q ok=%v", specifier, rewritten, ok)
    }
  }
  noOut := *rewriter
  noOut.outDir = ""
  if rewritten, ok := pathsRewrite(&noOut, src+"/main.ts", "@lib/message"); ok || rewritten != "@lib/message" {
    t.Fatalf("no outDir rewrite mismatch: rewritten=%q ok=%v", rewritten, ok)
  }
  outsideTarget := *rewriter
  outsideTarget.patterns = []pathsPathPattern{{pattern: "@outside", targets: []string{"outside.ts"}}}
  if rewritten, ok := pathsRewrite(&outsideTarget, src+"/main.ts", "@outside"); ok || rewritten != "@outside" {
    t.Fatalf("outside target rewrite mismatch: rewritten=%q ok=%v", rewritten, ok)
  }

  if got := pathsOutputPathForSource(rewriter, src+"/module.mts"); got != out+"/module.mjs" {
    t.Fatalf("mts output mismatch: %q", got)
  }
  if got := pathsOutputPathForSource(rewriter, src+"/module.cts"); got != out+"/module.cjs" {
    t.Fatalf("cts output mismatch: %q", got)
  }
  if got := pathsOutputPathForSource(rewriter, root+"/outside.ts"); got != "" {
    t.Fatalf("outside output mismatch: %q", got)
  }
  if got := pathsOutputPathForSource(&pathsRewriter{}, src+"/main.ts"); got != "" {
    t.Fatalf("empty output config mismatch: %q", got)
  }

  if star, ok := pathsMatchPattern("@lib/*/test", "@lib/a/test"); !ok || star != "a" {
    t.Fatalf("star pattern mismatch: star=%q ok=%v", star, ok)
  }
  if _, ok := pathsMatchPattern("@lib/*/test", "@lib/a/other"); ok {
    t.Fatal("unexpected suffix pattern match")
  }
  if _, ok := pathsMatchPattern("@lib/*/test", "@pkg/a/test"); ok {
    t.Fatal("unexpected prefix pattern match")
  }
  if _, ok := pathsMatchPattern("@exact", "@other"); ok {
    t.Fatal("unexpected exact pattern match")
  }
  if rank := pathsPatternRank("@lib/*/test"); rank != len("@lib//test") {
    t.Fatalf("pattern rank mismatch: %d", rank)
  }

  if got := pathsOptionalPath("", root); got != "" {
    t.Fatalf("empty optional path mismatch: %q", got)
  }
  if got := pathsOptionalPath(src, root); got != src {
    t.Fatalf("absolute optional path mismatch: %q", got)
  }
  if got := pathsOptionalPath("src", root); got != src {
    t.Fatalf("relative optional path mismatch: %q", got)
  }
  if got := pathsCommonSourceDir(nil); got != "" {
    t.Fatalf("empty common source dir mismatch: %q", got)
  }
  if got := pathsNormalizePath(""); got != "" {
    t.Fatalf("empty normalize mismatch: %q", got)
  }
  if got := pathsNormalizePath(filepath.Join(root, "src", "..", "src", "main.ts")); got != src+"/main.ts" {
    t.Fatalf("normalize mismatch: %q", got)
  }
  for input, expected := range map[string]string{
    "file.d.ts":  "file",
    "file.d.mts": "file",
    "file.d.cts": "file",
    "file.ts":    "file",
    "file.tsx":   "file",
    "file.mts":   "file",
    "file.cts":   "file",
    "file.js":    "file",
    "file.jsx":   "file",
    "file.mjs":   "file",
    "file.cjs":   "file",
    "file.other": "file",
  } {
    if got := pathsStripKnownSourceExtension(input); got != expected {
      t.Fatalf("strip mismatch for %s: %q", input, got)
    }
  }
  if got := pathsReplaceSourceExtension("src/main.ts", ".js"); got != "src/main.js" {
    t.Fatalf("replace extension mismatch: %q", got)
  }
  if !pathsIsOutsideRelativePath("..") || !pathsIsOutsideRelativePath(filepath.Join("..", "x")) || pathsIsOutsideRelativePath("..x") {
    t.Fatal("outside relative path classification mismatch")
  }
  if pathsEmittedJavaScriptExtension("x.mts", false) != ".mjs" ||
    pathsEmittedJavaScriptExtension("x.mjs", false) != ".mjs" ||
    pathsEmittedJavaScriptExtension("x.cts", false) != ".cjs" ||
    pathsEmittedJavaScriptExtension("x.cjs", false) != ".cjs" ||
    pathsEmittedJavaScriptExtension("x.tsx", true) != ".jsx" ||
    pathsEmittedJavaScriptExtension("x.jsx", true) != ".jsx" ||
    pathsEmittedJavaScriptExtension("x.jsx", false) != ".js" ||
    pathsEmittedJavaScriptExtension("x.ts", false) != ".js" {
    t.Fatal("emitted extension mismatch")
  }
}
