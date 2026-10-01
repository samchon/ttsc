// linkname_helpers.go exposes unexported symbols from the banner driver to
// the unit and e2e test packages via go:linkname. Each declaration mirrors the
// private function or variable exactly so driver unit tests can reach package
// internals without violating module boundaries.
package shared

import (
  "os/exec"
  _ "unsafe"

  _ "github.com/samchon/ttsc/packages/banner/driver"
)

//go:linkname BannerResolveBannerText github.com/samchon/ttsc/packages/banner/driver.resolveBannerText
func BannerResolveBannerText(config map[string]any, cwd, tsconfigPath string) (string, error)

//go:linkname BannerLoadBannerConfigFile github.com/samchon/ttsc/packages/banner/driver.loadBannerConfigFile
func BannerLoadBannerConfigFile(location, resolutionRoot string) (any, error)

//go:linkname BannerTypeScriptConfigLoaderTsconfig github.com/samchon/ttsc/packages/banner/driver.typeScriptConfigLoaderTsconfig
func BannerTypeScriptConfigLoaderTsconfig(loader, location, outDir string) string

//go:linkname BannerTtsxCommand github.com/samchon/ttsc/packages/banner/driver.ttsxCommand
func BannerTtsxCommand(anchors []string, args ...string) *exec.Cmd

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
