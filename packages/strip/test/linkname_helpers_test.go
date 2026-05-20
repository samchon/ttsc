// linkname_helpers_test.go exposes unexported symbols from the strip driver to
// this external test package via go:linkname. Each declaration mirrors a
// private type or function exactly so config and pattern unit tests can reach
// driver internals without crossing module boundaries.
package strip_test

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"

  _ "github.com/samchon/ttsc/packages/strip/driver"
  _ "unsafe"
)

type stripRewriter struct {
  calls         []stripCallPattern
  stripDebugger bool
}

type stripCallPattern struct {
  parts    []string
  wildcard bool
}

//go:linkname stripParseStrip github.com/samchon/ttsc/packages/strip/driver.parseStrip
func stripParseStrip(config map[string]any) (*stripRewriter, error)

//go:linkname stripApply github.com/samchon/ttsc/packages/strip/driver.(*stripRewriter).apply
func stripApply(s *stripRewriter, file *shimast.SourceFile)

//go:linkname stripMatchesCall github.com/samchon/ttsc/packages/strip/driver.(*stripRewriter).matchesCall
func stripMatchesCall(s *stripRewriter, name string) bool

//go:linkname stripParseCallPattern github.com/samchon/ttsc/packages/strip/driver.parseCallPattern
func stripParseCallPattern(text string) (stripCallPattern, error)

//go:linkname stripPatternMatches github.com/samchon/ttsc/packages/strip/driver.callPattern.matches
func stripPatternMatches(p stripCallPattern, name string) bool

//go:linkname stripShouldStripStatement github.com/samchon/ttsc/packages/strip/driver.shouldStripStatement
func stripShouldStripStatement(node *shimast.Node, strip *stripRewriter) bool

//go:linkname stripFilterChildStatements github.com/samchon/ttsc/packages/strip/driver.filterChildStatements
func stripFilterChildStatements(node *shimast.Node, strip *stripRewriter)

//go:linkname stripCallExpressionName github.com/samchon/ttsc/packages/strip/driver.callExpressionName
func stripCallExpressionName(expr *shimast.Node) (string, bool)

//go:linkname stripDottedName github.com/samchon/ttsc/packages/strip/driver.dottedName
func stripDottedName(expr *shimast.Node) (string, bool)

//go:linkname stripStringArrayConfig github.com/samchon/ttsc/packages/strip/driver.stringArrayConfig
func stripStringArrayConfig(config map[string]any, key string) ([]string, error)

//go:linkname stripEqualStringSlices github.com/samchon/ttsc/packages/strip/driver.equalStringSlices
func stripEqualStringSlices(left, right []string) bool
