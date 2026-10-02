package driver_test

import (
  "testing"

  "github.com/microsoft/typescript-go/shim/ast"
)

// TestProgramInternalGuards Verifies driver internal diagnostic guards handle
// nil inputs.
//
// The exported driver facade filters diagnostics from compiler shims that may
// contain nil entries during error recovery. These guard branches should remain
// no-ops instead of panicking inside the coverage path.
//
// 1. Normalize malformed nil diagnostic inputs.
// 2. Assert both helpers return safe empty values.
//
// @evidence contracts/testing.md#behavioral-verification Linked private diagnostic helpers return empty or false for nil inputs.
// @evidence contracts/testing.md#independent-expectations No diagnostic or overload exists for nil inputs, independently grounding no-op outcomes.
// @evidence contracts/testing.md#distinguishing-cases Nil slice, singleton nil entry and nil classifier argument hit different guards.
// @evidence contracts/testing.md#execution-ownership Go unit TestProgramInternalGuards is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
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
