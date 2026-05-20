// linkname_helpers_test.go exposes unexported symbols from the paths driver to
// this external test package via go:linkname. The declarations mirror private
// types and functions exactly so rewriter unit tests can reach driver internals
// without crossing module boundaries.
package paths_test

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"

  _ "github.com/samchon/ttsc/packages/paths/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver"
  _ "unsafe"
)

type pathsRewriter struct {
  basePath    string
  outDir      string
  patterns    []pathsPathPattern
  rootDir     string
  sourceFiles map[string]string
}

type pathsPathPattern struct {
  pattern string
  targets []string
}

//go:linkname pathsNewRewriter github.com/samchon/ttsc/packages/paths/driver.newRewriter
func pathsNewRewriter(prog *driver.Program) *pathsRewriter

//go:linkname pathsApply github.com/samchon/ttsc/packages/paths/driver.(*rewriter).apply
func pathsApply(r *pathsRewriter, file *shimast.SourceFile)

//go:linkname pathsVisitModuleSpecifiers github.com/samchon/ttsc/packages/paths/driver.visitModuleSpecifiers
func pathsVisitModuleSpecifiers(node *shimast.Node, visit func(*shimast.Node))

//go:linkname pathsIsModuleSpecifierCall github.com/samchon/ttsc/packages/paths/driver.isModuleSpecifierCall
func pathsIsModuleSpecifierCall(call *shimast.CallExpression) bool

//go:linkname pathsRewrite github.com/samchon/ttsc/packages/paths/driver.(*rewriter).rewrite
func pathsRewrite(r *pathsRewriter, fromSource string, specifier string) (string, bool)

//go:linkname pathsResolveSource github.com/samchon/ttsc/packages/paths/driver.(*rewriter).resolveSource
func pathsResolveSource(r *pathsRewriter, specifier string) (string, bool)

//go:linkname pathsLookupSource github.com/samchon/ttsc/packages/paths/driver.(*rewriter).lookupSource
func pathsLookupSource(r *pathsRewriter, candidate string) (string, bool)

//go:linkname pathsOutputPathForSource github.com/samchon/ttsc/packages/paths/driver.(*rewriter).outputPathForSource
func pathsOutputPathForSource(r *pathsRewriter, source string) string

//go:linkname pathsMatchPattern github.com/samchon/ttsc/packages/paths/driver.matchPattern
func pathsMatchPattern(pattern string, specifier string) (string, bool)

//go:linkname pathsPatternRank github.com/samchon/ttsc/packages/paths/driver.patternRank
func pathsPatternRank(pattern string) int

//go:linkname pathsOptionalPath github.com/samchon/ttsc/packages/paths/driver.optionalPath
func pathsOptionalPath(value string, cwd string) string

//go:linkname pathsCommonSourceDir github.com/samchon/ttsc/packages/paths/driver.commonSourceDir
func pathsCommonSourceDir(files []*shimast.SourceFile) string

//go:linkname pathsNormalizePath github.com/samchon/ttsc/packages/paths/driver.normalizePath
func pathsNormalizePath(value string) string

//go:linkname pathsStripKnownSourceExtension github.com/samchon/ttsc/packages/paths/driver.stripKnownSourceExtension
func pathsStripKnownSourceExtension(value string) string

//go:linkname pathsReplaceSourceExtension github.com/samchon/ttsc/packages/paths/driver.replaceSourceExtension
func pathsReplaceSourceExtension(value string, ext string) string

//go:linkname pathsIsOutsideRelativePath github.com/samchon/ttsc/packages/paths/driver.isOutsideRelativePath
func pathsIsOutsideRelativePath(rel string) bool

//go:linkname pathsEmittedJavaScriptExtension github.com/samchon/ttsc/packages/paths/driver.emittedJavaScriptExtension
func pathsEmittedJavaScriptExtension(source string) string
