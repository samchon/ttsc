// linkname_helpers.go exposes unexported symbols from the banner driver to
// the unit test package via go:linkname. Each declaration mirrors the
// private function or variable exactly so driver unit tests can reach package
// internals without violating module boundaries.
package shared

import (
  "context"
  "os/exec"
  _ "unsafe"

  _ "github.com/samchon/ttsc/packages/banner/driver"
)

// bannerLoadedConfig mirrors the driver's unexported result of one config load
// field for field; the linknamed loaders below return it by value.
type bannerLoadedConfig struct {
  complete  bool
  hashes    map[string]*string
  inputs    []string
  realpaths map[string]*string
  value     any
}

//go:linkname bannerResolveBannerTextWithReporters github.com/samchon/ttsc/packages/banner/driver.resolveBannerTextWithReporters
func bannerResolveBannerTextWithReporters(config map[string]any, cwd, tsconfigPath string, reporter func(string), hashReporter func(string, *string), realpathReporter func(string, *string), incompleteReporters ...func()) (string, error)

//go:linkname bannerParseBannerWithReporters github.com/samchon/ttsc/packages/banner/driver.parseBannerWithReporters
func bannerParseBannerWithReporters(config map[string]any, cwd, tsconfigPath string, reporter func(string), hashReporter func(string, *string), realpathReporter func(string, *string), incompleteReporters ...func()) (string, error)

//go:linkname bannerLoadConfigFileWithInputs github.com/samchon/ttsc/packages/banner/driver.loadBannerConfigFileWithInputs
func bannerLoadConfigFileWithInputs(location, resolutionRoot string) (bannerLoadedConfig, error)

//go:linkname bannerLoadScriptConfigFileWithInputs github.com/samchon/ttsc/packages/banner/driver.loadBannerScriptConfigFileWithInputs
func bannerLoadScriptConfigFileWithInputs(location string) (bannerLoadedConfig, error)

//go:linkname bannerLoadTypeScriptConfigFileWithInputs github.com/samchon/ttsc/packages/banner/driver.loadBannerTypeScriptConfigFileWithInputs
func bannerLoadTypeScriptConfigFileWithInputs(location, resolutionRoot string) (bannerLoadedConfig, error)

//go:linkname bannerTtsxCommandContext github.com/samchon/ttsc/packages/banner/driver.ttsxCommandContext
func bannerTtsxCommandContext(ctx context.Context, anchors []string, args ...string) *exec.Cmd

// BannerResolveBannerText resolves banner text without observation reporters.
func BannerResolveBannerText(config map[string]any, cwd, tsconfigPath string) (string, error) {
  return bannerResolveBannerTextWithReporters(config, cwd, tsconfigPath, nil, nil, nil)
}

// BannerParseBanner formats banner text without observation reporters.
func BannerParseBanner(config map[string]any, cwd, tsconfigPath string) (string, error) {
  return bannerParseBannerWithReporters(config, cwd, tsconfigPath, nil, nil, nil)
}

// BannerLoadBannerConfigFile loads a config file through the production
// dispatcher and returns its exported value.
func BannerLoadBannerConfigFile(location, resolutionRoot string) (any, error) {
  loaded, err := bannerLoadConfigFileWithInputs(location, resolutionRoot)
  return loaded.value, err
}

// BannerLoadBannerScriptConfigFile loads a JS/CJS/MJS config and returns its value.
func BannerLoadBannerScriptConfigFile(location string) (any, error) {
  loaded, err := bannerLoadScriptConfigFileWithInputs(location)
  return loaded.value, err
}

// BannerLoadBannerTypeScriptConfigFile loads a TypeScript config and returns its value.
func BannerLoadBannerTypeScriptConfigFile(location, resolutionRoot string) (any, error) {
  loaded, err := bannerLoadTypeScriptConfigFileWithInputs(location, resolutionRoot)
  return loaded.value, err
}

//go:linkname BannerTypeScriptConfigLoaderTsconfig github.com/samchon/ttsc/packages/banner/driver.typeScriptConfigLoaderTsconfig
func BannerTypeScriptConfigLoaderTsconfig(loader, location, outDir string) string

// BannerTtsxCommand builds the ttsx command without a deadline context.
func BannerTtsxCommand(anchors []string, args ...string) *exec.Cmd {
  return bannerTtsxCommandContext(context.Background(), anchors, args...)
}

//go:linkname BannerConfigToolAnchors github.com/samchon/ttsc/packages/banner/driver.configToolAnchors
func BannerConfigToolAnchors(configPath, resolutionRoot string) []string

//go:linkname BannerResolveConfigTsgo github.com/samchon/ttsc/packages/banner/driver.resolveConfigTsgo
func BannerResolveConfigTsgo(anchors []string) string

//go:linkname BannerNodePlatformPair github.com/samchon/ttsc/packages/banner/driver.nodePlatformPair
func BannerNodePlatformPair() (string, string)

//go:linkname BannerRealpathIfPossible github.com/samchon/ttsc/packages/banner/driver.realpathIfPossible
func BannerRealpathIfPossible(location string) string

//go:linkname BannerFindNearestNodeModules github.com/samchon/ttsc/packages/banner/driver.findNearestNodeModules
func BannerFindNearestNodeModules(start string) string
