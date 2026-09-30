// linkname_helpers_test.go exposes unexported symbols from the strip driver to
// this external test package via go:linkname. Each declaration mirrors a
// private type or function exactly so config and pattern unit tests can reach
// driver internals without crossing module boundaries.
package strip_test

import (
  "context"
  "os/exec"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  _ "github.com/samchon/ttsc/packages/strip/driver"
  _ "unsafe"
)

//go:linkname stripLoadStripConfigMap github.com/samchon/ttsc/packages/strip/driver.loadStripConfigMap
func stripLoadStripConfigMap(pluginConfig map[string]any, cwd, tsconfigPath string) (map[string]any, error)

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

//go:linkname stripTypeScriptLoaderTsconfig github.com/samchon/ttsc/packages/strip/driver.stripTypeScriptLoaderTsconfig
func stripTypeScriptLoaderTsconfig(loader, location, outDir string) string

//go:linkname stripLoaderTempBase github.com/samchon/ttsc/packages/strip/driver.stripLoaderTempBase
func stripLoaderTempBase(location, systemTemp string) string

//go:linkname stripFindNearestNodeModules github.com/samchon/ttsc/packages/strip/driver.stripFindNearestNodeModules
func stripFindNearestNodeModules(start string) string

//go:linkname stripLoadStripConfigFile github.com/samchon/ttsc/packages/strip/driver.loadStripConfigFile
func stripLoadStripConfigFile(location, resolutionRoot string) (any, error)

//go:linkname stripConfigToolAnchors github.com/samchon/ttsc/packages/strip/driver.stripConfigToolAnchors
func stripConfigToolAnchors(configPath, resolutionRoot string) []string

//go:linkname stripResolveConfigTsgo github.com/samchon/ttsc/packages/strip/driver.stripResolveConfigTsgo
func stripResolveConfigTsgo(anchors []string) string

//go:linkname stripResolveTtsxLauncher github.com/samchon/ttsc/packages/strip/driver.stripResolveTtsxLauncher
func stripResolveTtsxLauncher(anchors []string) string

//go:linkname stripNodePackageManifestFrom github.com/samchon/ttsc/packages/strip/driver.stripNodePackageManifestFrom
func stripNodePackageManifestFrom(anchor, pkg string) string

//go:linkname stripNodePlatformPair github.com/samchon/ttsc/packages/strip/driver.stripNodePlatformPair
func stripNodePlatformPair() (string, string)

//go:linkname stripNodePlatformPairFor github.com/samchon/ttsc/packages/strip/driver.stripNodePlatformPairFor
func stripNodePlatformPairFor(goos, goarch string) (string, string)

//go:linkname stripRealpathIfPossible github.com/samchon/ttsc/packages/strip/driver.stripRealpathIfPossible
func stripRealpathIfPossible(location string) string

//go:linkname stripPhysicalHostInput github.com/samchon/ttsc/packages/strip/driver.stripPhysicalHostInput
func stripPhysicalHostInput(location string) *string

//go:linkname stripTtsxCommandContext github.com/samchon/ttsc/packages/strip/driver.stripTtsxCommandContext
func stripTtsxCommandContext(ctx context.Context, anchors []string, args ...string) *exec.Cmd
