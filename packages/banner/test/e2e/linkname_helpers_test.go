//go:build e2e

// linkname_helpers_test.go exposes unexported symbols from the banner driver to
// this external test package via go:linkname. Each declaration mirrors the
// private function or variable exactly so driver unit tests can reach package
// internals without violating module boundaries.
package banner_test

import (
  _ "unsafe"

  _ "github.com/samchon/ttsc/packages/banner/driver"
)

//go:linkname bannerRelativeImportSpecifier github.com/samchon/ttsc/packages/banner/driver.relativeImportSpecifier
func bannerRelativeImportSpecifier(fromDir, location string) (string, error)

//go:linkname bannerTypeScriptConfigLoaderSource github.com/samchon/ttsc/packages/banner/driver.bannerTypeScriptConfigLoaderSource
func bannerTypeScriptConfigLoaderSource(importLiteral, recorderLiteral string) string

//go:linkname bannerLoaderTempBase github.com/samchon/ttsc/packages/banner/driver.loaderTempBase
func bannerLoaderTempBase(location, systemTemp string) string

//go:linkname bannerShouldRunTtsxThroughNode github.com/samchon/ttsc/packages/banner/driver.shouldRunTtsxThroughNode
func bannerShouldRunTtsxThroughNode(binary string) bool

//go:linkname bannerPhysicalHostInput github.com/samchon/ttsc/packages/banner/driver.physicalHostInput
func bannerPhysicalHostInput(location string) *string
