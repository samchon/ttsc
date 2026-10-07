// linkname_helpers.go exposes unexported symbols from the strip driver to
// the unit and e2e test packages via go:linkname. Each declaration mirrors a
// private type or function exactly so config and pattern unit tests can reach
// driver internals without crossing module boundaries.
package shared

import (
  _ "unsafe"

  _ "github.com/samchon/ttsc/packages/strip/driver"
)

//go:linkname StripConfigToolAnchors github.com/samchon/ttsc/packages/strip/driver.stripConfigToolAnchors
func StripConfigToolAnchors(configPath, resolutionRoot string) []string

//go:linkname StripResolveConfigTsgo github.com/samchon/ttsc/packages/strip/driver.stripResolveConfigTsgo
func StripResolveConfigTsgo(anchors []string) string

//go:linkname StripNodePlatformPair github.com/samchon/ttsc/packages/strip/driver.stripNodePlatformPair
func StripNodePlatformPair() (string, string)

//go:linkname StripRealpathIfPossible github.com/samchon/ttsc/packages/strip/driver.stripRealpathIfPossible
func StripRealpathIfPossible(location string) string
