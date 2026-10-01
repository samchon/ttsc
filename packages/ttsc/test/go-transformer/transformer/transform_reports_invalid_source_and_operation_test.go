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
//
// @evidence contracts/testing.md#behavioral-verification Transform rejects a source without goUpper and an unsupported go-reverse operation with their distinct diagnostic identities.
// @evidence contracts/testing.md#independent-expectations Exact literal error strings fix both failure reasons independently; a valid uppercase input remains a successful control.
// @evidence contracts/testing.md#distinguishing-cases Invalid source and valid source with invalid operation distinguish the two rejection branches from unconditional failure; original failure assertions remain.
// @evidence contracts/testing.md#execution-ownership The case calls Transform in-process and checks returned errors, without testing CLI diagnostic transport.
func TestTransformReportsInvalidSourceAndOperation(t *testing.T) {
  if _, err := Transform(`export const message = "hello";`, nil); err == nil {
    t.Fatal("missing goUpper call must fail")
  }
  if _, err := Transform(`export const message: string = goUpper("hello");`, []Plugin{
    {Operation: "go-reverse"},
  }); err == nil || !strings.Contains(err.Error(), "unsupported operation") {
    t.Fatalf("unsupported operation error mismatch: %v", err)
  }

  if _, err := Transform(`export const message = "hello";`, nil); err == nil || err.Error() != `go transformer: expected export const value = goUpper("...")` { t.Fatalf("source diagnostic = %v", err) }
  if _, err := Transform(`export const message: string = goUpper("hello");`, []Plugin{{Operation:"go-reverse"}}); err == nil || err.Error() != `go transformer: unsupported operation "go-reverse"` { t.Fatalf("operation diagnostic = %v", err) }
  if _, err := Transform(`export const message: string = goUpper("hello");`, []Plugin{{Operation:"go-uppercase"}}); err != nil { t.Fatalf("valid operation rejected: %v", err) }
}
