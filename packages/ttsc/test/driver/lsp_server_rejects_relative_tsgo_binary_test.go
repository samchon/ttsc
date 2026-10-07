package driver_test

import (
  "context"
  "io"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRejectsRelativeTsgoBinary Verifies the upstream binary contract
// requires an absolute path.
//
// ttscserver should run the project-selected TypeScript-Go binary, not whatever
// happens to appear first on PATH. Keeping this validation in the native host
// protects callers that bypass the JavaScript launcher.
//
// 1. Call RunLSPServer with TsgoBinary="tsgo".
// 2. Supply empty editor input; validation rejects before either pump starts.
// 3. Assert the absolute-path validation error is surfaced.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer rejects TsgoBinary tsgo with an error containing must be absolute.
// @evidence contracts/testing.md#independent-expectations The default upstream executable must be an absolute selected path rather than PATH lookup; the relative literal establishes the rejected input.
// @evidence contracts/testing.md#distinguishing-cases A nonempty valid cwd and relative binary isolate path validation; missing and spawn-failure inputs are handled separately.
// @evidence contracts/testing.md#execution-ownership Go test/driver calls the server entry with empty input, but validation rejects before creating the product child.
func TestLSPServerRejectsRelativeTsgoBinary(t *testing.T) {
  err := driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
    In:         strings.NewReader(""),
    Out:        io.Discard,
    Err:        io.Discard,
    Cwd:        t.TempDir(),
    TsgoBinary: "tsgo",
  })
  if err == nil || !strings.Contains(err.Error(), "must be absolute") {
    t.Fatalf("expected absolute-path error, got %v", err)
  }
}
