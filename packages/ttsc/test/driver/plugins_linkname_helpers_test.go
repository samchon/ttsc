package driver_test

import (
  "encoding/json"

  "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  _ "unsafe"
)

//go:linkname driverPluginRegistry github.com/samchon/ttsc/packages/ttsc/driver.pluginRegistry
var driverPluginRegistry []any

//go:linkname driverIDKeyFromRaw github.com/samchon/ttsc/packages/ttsc/driver.idKeyFromRaw
func driverIDKeyFromRaw(raw json.RawMessage) string

//go:linkname driverConvertDiagnostics github.com/samchon/ttsc/packages/ttsc/driver.convertDiagnostics
func driverConvertDiagnostics(in []*ast.Diagnostic) []driver.Diagnostic

//go:linkname driverIsUnusedOverloadSignatureTypeParameterDiagnostic github.com/samchon/ttsc/packages/ttsc/driver.isUnusedOverloadSignatureTypeParameterDiagnostic
func driverIsUnusedOverloadSignatureTypeParameterDiagnostic(d *ast.Diagnostic) bool

//go:linkname driverApplyRewrites github.com/samchon/ttsc/packages/ttsc/driver.applyRewrites
func driverApplyRewrites(outputName, text string, rs *driver.RewriteSet, cursors map[string]int) (string, error)

func resetLinkedPluginRegistry() {
  driverPluginRegistry = nil
}
