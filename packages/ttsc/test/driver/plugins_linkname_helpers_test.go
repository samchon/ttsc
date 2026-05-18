package driver_test

import _ "unsafe"

//go:linkname driverPluginRegistry github.com/samchon/ttsc/packages/ttsc/driver.pluginRegistry
var driverPluginRegistry []any

func resetLinkedPluginRegistry() {
	driverPluginRegistry = nil
}
