package ttsc_test

import (
  _ "github.com/samchon/ttsc/packages/ttsc/utility"
  _ "unsafe"
)

//go:linkname utilityFilterHostArgs github.com/samchon/ttsc/packages/ttsc/utility.filterHostArgs
func utilityFilterHostArgs(args []string) []string

//go:linkname utilityFindBannerConfigFile github.com/samchon/ttsc/packages/ttsc/utility.findBannerConfigFile
func utilityFindBannerConfigFile(cwd string, tsconfigPath string) (string, error)

//go:linkname utilityParseBanner github.com/samchon/ttsc/packages/ttsc/utility.parseBanner
func utilityParseBanner(config map[string]any, cwd string, tsconfigPath string) (string, error)

//go:linkname utilityResolveBannerText github.com/samchon/ttsc/packages/ttsc/utility.resolveBannerText
func utilityResolveBannerText(config map[string]any, cwd string, tsconfigPath string) (string, error)

//go:linkname utilityStripKnownSourceExtension github.com/samchon/ttsc/packages/ttsc/utility.stripKnownSourceExtension
func utilityStripKnownSourceExtension(value string) string

//go:linkname utilityReplaceSourceExtension github.com/samchon/ttsc/packages/ttsc/utility.replaceSourceExtension
func utilityReplaceSourceExtension(value string, ext string) string

//go:linkname utilityEmittedJavaScriptExtension github.com/samchon/ttsc/packages/ttsc/utility.emittedJavaScriptExtension
func utilityEmittedJavaScriptExtension(source string) string
