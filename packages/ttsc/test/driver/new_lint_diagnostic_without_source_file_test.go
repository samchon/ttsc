package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverNewLintDiagnosticWithoutSourceFile verifies detached lint findings
// keep stable severity and message data.
//
// Plugins can report configuration-level findings before a source file exists,
// and those diagnostics should still participate in CountErrors correctly.
//
// 1. Create a warning lint diagnostic without a source file.
// 2. Assert source location fields stay empty.
// 3. Assert warning severity does not increment the build error count.
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
