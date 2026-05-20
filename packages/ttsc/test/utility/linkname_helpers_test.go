// Package ttsc_test exposes unexported utility and driver symbols to the
// utility test suite via go:linkname. The blank imports on driver and utility
// ensure both packages are linked into the test binary so the linkname
// directives below resolve at link time.
package ttsc_test

import (
  "github.com/samchon/ttsc/packages/ttsc/driver"
  _ "github.com/samchon/ttsc/packages/ttsc/utility"
  _ "unsafe"
)

//go:linkname utilityFilterHostArgs github.com/samchon/ttsc/packages/ttsc/utility.filterHostArgs
func utilityFilterHostArgs(args []string) []string

//go:linkname utilityParsePluginEntries github.com/samchon/ttsc/packages/ttsc/utility.parsePluginEntries
func utilityParsePluginEntries(input string) ([]driver.PluginEntry, error)

//go:linkname utilitySetLinkedPluginManifest github.com/samchon/ttsc/packages/ttsc/utility.setLinkedPluginManifest
func utilitySetLinkedPluginManifest(input string) func()

//go:linkname utilityShouldEnsureSourcePreamble github.com/samchon/ttsc/packages/ttsc/utility.shouldEnsureSourcePreamble
func utilityShouldEnsureSourcePreamble(fileName, text, sourcePreamble string) bool

//go:linkname utilityShouldRemoveComments github.com/samchon/ttsc/packages/ttsc/utility.shouldRemoveComments
func utilityShouldRemoveComments(prog *driver.Program) bool

//go:linkname utilityAPIOutputKey github.com/samchon/ttsc/packages/ttsc/utility.apiOutputKey
func utilityAPIOutputKey(cwd, fileName string) string

//go:linkname driverPluginRegistry github.com/samchon/ttsc/packages/ttsc/driver.pluginRegistry
var driverPluginRegistry []any

func resetLinkedPluginRegistry() {
  driverPluginRegistry = nil
}
