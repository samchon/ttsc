package driver_test

import (
  "testing"

  "github.com/microsoft/typescript-go/shim/ast"
)

// TestProgramInternalGuards verifies driver internal diagnostic guards handle
// nil inputs.
//
// The exported driver facade filters diagnostics from compiler shims that may
// contain nil entries during error recovery. These guard branches should remain
// no-ops instead of panicking inside the coverage path.
//
// 1. Normalize malformed nil diagnostic inputs.
// 2. Assert both helpers return safe empty values.
func TestProgramInternalGuards(t *testing.T) {
  if got := driverConvertDiagnostics(nil); len(got) != 0 {
    t.Fatalf("nil diagnostic slice mismatch: %#v", got)
  }
  if got := driverConvertDiagnostics([]*ast.Diagnostic{nil}); len(got) != 0 {
    t.Fatalf("nil diagnostic entry mismatch: %#v", got)
  }
  if driverIsUnusedOverloadSignatureTypeParameterDiagnostic(nil) {
    t.Fatal("nil diagnostic should not be filtered as unused overload")
  }
}
