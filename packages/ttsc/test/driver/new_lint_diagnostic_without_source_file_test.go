package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverNewLintDiagnosticWithoutSourceFile Verifies detached lint findings
// keep stable severity and message data.
//
// Plugins can report configuration-level findings before a source file exists,
// and those diagnostics should still participate in CountErrors correctly.
//
// 1. Create a warning lint diagnostic without a source file.
// 2. Assert source location fields stay empty.
// 3. Assert warning severity does not increment the build error count.
//
// @evidence contracts/testing.md#behavioral-verification NewLintDiagnostic preserves detached warning data and CountErrors returns zero.
// @evidence contracts/testing.md#independent-expectations Authored warning severity, code 7001 and message establish literal expected fields.
// @evidence contracts/testing.md#distinguishing-cases Nil source with negative offsets must have empty locations; error severity is separate.
// @evidence contracts/testing.md#execution-ownership The owning Go unit directly constructs a detached diagnostic and counts it without a Program, filesystem fixture, consumer installation or native process.
func TestDriverNewLintDiagnosticWithoutSourceFile(t *testing.T) {
  diag := driver.NewLintDiagnostic(nil, -1, -1, 7001, driver.SeverityWarning, "detached warning")
  if diag.File != "" || diag.Line != 0 || diag.Column != 0 || diag.Start != nil || diag.Length != nil {
    t.Fatalf("detached diagnostic should not expose source location: %#v", diag)
  }
  if diag.Message != "detached warning" || diag.Code != 7001 || diag.IsError() {
    t.Fatalf("detached diagnostic data mismatch: %#v", diag)
  }
  if got := driver.CountErrors([]driver.Diagnostic{diag}); got != 0 {
    t.Fatalf("warning lint diagnostic should not count as error: %d", got)
  }
}
