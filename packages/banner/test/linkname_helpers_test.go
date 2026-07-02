// linkname_helpers_test.go exposes unexported symbols from the banner driver to
// this external test package via go:linkname. Each declaration mirrors the
// private function or variable exactly so driver unit tests can reach package
// internals without violating module boundaries.
package banner_test

import (
  "os"
  "os/exec"

  _ "github.com/samchon/ttsc/packages/banner/driver"
  _ "unsafe"
)

//go:linkname bannerParseBanner github.com/samchon/ttsc/packages/banner/driver.parseBanner
func bannerParseBanner(config map[string]any, cwd, tsconfigPath string) (string, error)

//go:linkname bannerResolveBannerText github.com/samchon/ttsc/packages/banner/driver.resolveBannerText
func bannerResolveBannerText(config map[string]any, cwd, tsconfigPath string) (string, error)

//go:linkname bannerValidateBannerConfig github.com/samchon/ttsc/packages/banner/driver.validateBannerConfig
func bannerValidateBannerConfig(config map[string]any) error

//go:linkname bannerTextFromConfigValue github.com/samchon/ttsc/packages/banner/driver.bannerTextFromConfigValue
func bannerTextFromConfigValue(raw any, label string) (string, bool, error)

//go:linkname bannerFindBannerConfigFile github.com/samchon/ttsc/packages/banner/driver.findBannerConfigFile
func bannerFindBannerConfigFile(cwd, tsconfigPath string) (string, error)

//go:linkname bannerResolveBannerConfigPath github.com/samchon/ttsc/packages/banner/driver.resolveBannerConfigPath
func bannerResolveBannerConfigPath(configPath, cwd, tsconfigPath string) string

//go:linkname bannerTsconfigBaseDir github.com/samchon/ttsc/packages/banner/driver.tsconfigBaseDir
func bannerTsconfigBaseDir(cwd, tsconfigPath string) string

//go:linkname bannerLoadBannerConfigFile github.com/samchon/ttsc/packages/banner/driver.loadBannerConfigFile
func bannerLoadBannerConfigFile(location string) (any, error)

//go:linkname bannerIsBannerConfigFileName github.com/samchon/ttsc/packages/banner/driver.isBannerConfigFileName
func bannerIsBannerConfigFileName(name string) bool

//go:linkname bannerLoadBannerJSONConfigFile github.com/samchon/ttsc/packages/banner/driver.loadBannerJSONConfigFile
func bannerLoadBannerJSONConfigFile(location string) (any, error)

//go:linkname bannerLoadBannerScriptConfigFile github.com/samchon/ttsc/packages/banner/driver.loadBannerScriptConfigFile
func bannerLoadBannerScriptConfigFile(location string) (any, error)

//go:linkname bannerLoadBannerTypeScriptConfigFile github.com/samchon/ttsc/packages/banner/driver.loadBannerTypeScriptConfigFile
func bannerLoadBannerTypeScriptConfigFile(location string) (any, error)

//go:linkname bannerRelativeImportSpecifier github.com/samchon/ttsc/packages/banner/driver.relativeImportSpecifier
func bannerRelativeImportSpecifier(fromDir, location string) (string, error)

//go:linkname bannerTypeScriptConfigLoaderSource github.com/samchon/ttsc/packages/banner/driver.bannerTypeScriptConfigLoaderSource
func bannerTypeScriptConfigLoaderSource(importLiteral string) string

//go:linkname bannerTypeScriptConfigLoaderTsconfig github.com/samchon/ttsc/packages/banner/driver.typeScriptConfigLoaderTsconfig
func bannerTypeScriptConfigLoaderTsconfig(loader, location, outDir string) string

//go:linkname bannerLoaderTempBase github.com/samchon/ttsc/packages/banner/driver.loaderTempBase
func bannerLoaderTempBase(location, systemTemp string) string

//go:linkname bannerTtsxCommand github.com/samchon/ttsc/packages/banner/driver.ttsxCommand
func bannerTtsxCommand(args ...string) *exec.Cmd

//go:linkname bannerShouldRunTtsxThroughNode github.com/samchon/ttsc/packages/banner/driver.shouldRunTtsxThroughNode
func bannerShouldRunTtsxThroughNode(binary string) bool

//go:linkname bannerNodeConfigLoaderEnv github.com/samchon/ttsc/packages/banner/driver.nodeConfigLoaderEnv
func bannerNodeConfigLoaderEnv(location string) []string

//go:linkname bannerLinkNearestNodeModules github.com/samchon/ttsc/packages/banner/driver.linkNearestNodeModules
func bannerLinkNearestNodeModules(tempDir, sourceDir string) error

//go:linkname bannerFindNearestNodeModules github.com/samchon/ttsc/packages/banner/driver.findNearestNodeModules
func bannerFindNearestNodeModules(start string) string

//go:linkname bannerSetEnv github.com/samchon/ttsc/packages/banner/driver.setEnv
func bannerSetEnv(env []string, key, value string) []string

//go:linkname bannerSanitizeJSDocLine github.com/samchon/ttsc/packages/banner/driver.sanitizeJSDocLine
func bannerSanitizeJSDocLine(line string) string

//go:linkname bannerLinkConfigNodeModules github.com/samchon/ttsc/packages/banner/driver.linkConfigNodeModules
var bannerLinkConfigNodeModules func(tempDir, sourceDir string) error

//go:linkname bannerWriteConfigLoaderFile github.com/samchon/ttsc/packages/banner/driver.writeConfigLoaderFile
var bannerWriteConfigLoaderFile func(string, []byte, os.FileMode) error
