package transformer

import (
  "strings"
  "testing"
)

// TestTransformReportsInvalidSourceAndOperation verifies failure diagnostics.
//
// The fixture must reject sources that do not contain the synthetic goUpper
// call and manifests that request unsupported operations. These errors are the
// observable contract for host-side failure tests.
//
// 1. Transform a source file without a goUpper call.
// 2. Transform a valid source file with an unsupported operation.
// 3. Assert both cases fail and the operation error is specific.
func TestTransformReportsInvalidSourceAndOperation(t *testing.T) {
  if _, err := Transform(`export const message = "hello";`, nil); err == nil {
    t.Fatal("missing goUpper call must fail")
  }
  if _, err := Transform(`export const message: string = goUpper("hello");`, []Plugin{
    {Operation: "go-reverse"},
  }); err == nil || !strings.Contains(err.Error(), "unsupported operation") {
    t.Fatalf("unsupported operation error mismatch: %v", err)
  }
}
