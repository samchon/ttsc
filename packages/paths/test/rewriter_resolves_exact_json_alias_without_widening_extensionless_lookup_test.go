package paths_test

import (
	"path/filepath"
	"testing"
)

// TestRewriterResolvesExactJsonAliasWithoutWideningExtensionlessLookup pins the
// resolution seam that feeds the JSON output-extension fix (#680).
//
// The predictor may only preserve a `.json` extension for a source the resolver
// actually committed to. Two invariants keep that honest: an exact alias to a
// `.json` source resolves and rewrites to `./data.json` (the file the compiler
// copies), while an extensionless alias whose stem only exists as `.json` must
// stay unrewritten — `sourceLookupExtensions` deliberately excludes `.json`, so
// the negative twin proves the extension-fallback lookup was not accidentally
// widened. Without the negative case a future edit adding `.json` to that list
// would silently pass every other test.
//
//  1. Build a rewriter with an exact `.json` target and an extensionless target
//     backed only by a `.json` source.
//  2. Resolve and rewrite both aliases from a sibling `.ts` source.
//  3. Assert the exact alias rewrites to `./data.json` and the extensionless one
//     is left unchanged.
func TestRewriterResolvesExactJsonAliasWithoutWideningExtensionlessLookup(t *testing.T) {
	root := filepath.ToSlash(filepath.Join(t.TempDir(), "repo"))
	src := root + "/src"
	out := root + "/dist"
	rewriter := &pathsRewriter{
		basePath: root,
		outDir:   out,
		rootDir:  src,
		patterns: []pathsPathPattern{
			{pattern: "@data", targets: []string{"src/data.json"}},
			{pattern: "@bare", targets: []string{"src/config"}},
		},
		sourceFiles: map[string]string{
			src + "/main.ts":     src + "/main.ts",
			src + "/data.json":   src + "/data.json",
			src + "/config.json": src + "/config.json",
		},
	}

	// Transformation direction: an exact `.json` alias resolves to the copied
	// source and rewrites to the extension the compiler actually emits.
	if source, ok := pathsResolveSource(rewriter, "@data"); !ok || source != src+"/data.json" {
		t.Fatalf("exact json source mismatch: source=%q ok=%v", source, ok)
	}
	if rewritten, ok := pathsRewrite(rewriter, src+"/main.ts", "@data"); !ok || rewritten != "./data.json" {
		t.Fatalf("exact json rewrite mismatch: rewritten=%q ok=%v", rewritten, ok)
	}

	// Negative twin: an extensionless target backed only by a `.json` source must
	// not resolve, because `.json` is not a source-lookup extension. The alias is
	// left untouched instead of being rewritten to an invented file.
	if source, ok := pathsResolveSource(rewriter, "@bare"); ok {
		t.Fatalf("extensionless json target must not resolve: source=%q", source)
	}
	if rewritten, ok := pathsRewrite(rewriter, src+"/main.ts", "@bare"); ok || rewritten != "@bare" {
		t.Fatalf("extensionless json rewrite must be left alone: rewritten=%q ok=%v", rewritten, ok)
	}
}
