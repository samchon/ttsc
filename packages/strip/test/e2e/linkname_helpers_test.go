//go:build e2e

// linkname_helpers_test.go exposes unexported symbols from the strip driver to
// this external test package via go:linkname. Each declaration mirrors a
// private type or function exactly so config and pattern unit tests can reach
// driver internals without crossing module boundaries.
package strip_test

import (
  _ "unsafe"

  _ "github.com/samchon/ttsc/packages/strip/driver"
)

//go:linkname stripLoaderTempBase github.com/samchon/ttsc/packages/strip/driver.stripLoaderTempBase
func stripLoaderTempBase(location, systemTemp string) string

//go:linkname stripFindNearestNodeModules github.com/samchon/ttsc/packages/strip/driver.stripFindNearestNodeModules
func stripFindNearestNodeModules(start string) string

type stripLoadedConfig struct {
  complete  bool
  hashes    map[string]*string
  inputs    []string
  realpaths map[string]*string
  value     any
}

//go:linkname stripLoadStripConfigFileWithInputs github.com/samchon/ttsc/packages/strip/driver.loadStripConfigFileWithInputs
func stripLoadStripConfigFileWithInputs(location, resolutionRoot string) (stripLoadedConfig, error)

// stripLoadStripConfigFile returns the evaluated config value alone.
func stripLoadStripConfigFile(location, resolutionRoot string) (any, error) {
  loaded, err := stripLoadStripConfigFileWithInputs(location, resolutionRoot)
  return loaded.value, err
}

//go:linkname stripPhysicalHostInput github.com/samchon/ttsc/packages/strip/driver.stripPhysicalHostInput
func stripPhysicalHostInput(location string) *string
