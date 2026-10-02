package driver_test

import (
  "context"
  "errors"
  "io"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRejectsMissingTsgoBinary Verifies the native wrapper refuses to
// start without an explicit upstream tsgo executable.
//
// The JavaScript launcher normally resolves typescript and
// passes TTSC_TSGO_BINARY. Direct native hosts need the same contract; otherwise
// ttscserver might accidentally run a stale tsgo from PATH.
//
// 1. Supply a valid cwd and an empty editor reader without TsgoBinary.
// 2. Invoke RunLSPServer with the default upstream options.
// 3. Assert ErrLSPTsgoBinaryRequired before any runner starts.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer rejects absent TsgoBinary before process startup.
// @evidence contracts/testing.md#independent-expectations The default upstream requires an explicitly supplied executable.
// @evidence contracts/testing.md#distinguishing-cases Valid cwd and empty editor input isolate missing binary from other option or transport errors.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPServerRejectsMissingTsgoBinary in test/driver exercises default-runner option validation before subprocess startup. No child is launched.
func TestLSPServerRejectsMissingTsgoBinary(t *testing.T) {
  err := driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
    In:  strings.NewReader(""),
    Out: io.Discard,
    Err: io.Discard,
    Cwd: t.TempDir(),
  })
  if !errors.Is(err, driver.ErrLSPTsgoBinaryRequired) {
    t.Fatalf("expected ErrLSPTsgoBinaryRequired, got %v", err)
  }
}
