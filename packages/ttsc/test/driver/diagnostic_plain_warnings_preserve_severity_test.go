package driver_test

import (
  "bytes"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDiagnosticPlainWarningsPreserveSeverity Verifies plain warning diagnostics retain
// warning severity in counting and formatted output.
//
// Native hosts may receive diagnostic DTOs without a raw compiler or lint
// object. That representation must not turn a warning into a build error.
//
// 1. Construct an explicit warning and a default error without source anchors.
// 2. Count empty, warning-only and mixed diagnostic batches.
// 3. Render both and assert their severity and codes remain visible.
//
// @evidence contracts/testing.md#behavioral-verification Calls CountErrors and WritePrettyDiagnostics for plain diagnostic DTOs and asserts exact warning/default-error counts and rendered severity/code/message substrings.
// @evidence contracts/testing.md#independent-expectations Literal zero and one counts and warning TS1001: advice/error TS1002: failure are authored independently of rendering and counting.
// @evidence contracts/testing.md#distinguishing-cases Empty, warning-only and mixed batches distinguish omission of explicit warning severity from the default error fallback.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit executes DTO-only public operations with a local buffer; no compiler, filesystem or process is involved.
func TestDiagnosticPlainWarningsPreserveSeverity(t *testing.T) {
  warning := driver.Diagnostic{Severity: driver.SeverityWarning, Code: 1001, Message: "advice"}
  failure := driver.Diagnostic{Code: 1002, Message: "failure"}
  if driver.CountErrors(nil) != 0 || driver.CountErrors([]driver.Diagnostic{warning}) != 0 || driver.CountErrors([]driver.Diagnostic{warning, failure}) != 1 {
    t.Fatal("plain diagnostic severity changed the error count")
  }
  var out bytes.Buffer
  driver.WritePrettyDiagnostics(&out, []driver.Diagnostic{warning, failure}, "")
  for _, text := range []string{"warning TS1001: advice", "error TS1002: failure"} {
    if !strings.Contains(out.String(), text) {
      t.Fatalf("missing %q: %s", text, out.String())
    }
  }
}
