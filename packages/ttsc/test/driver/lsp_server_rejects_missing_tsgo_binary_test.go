package driver_test

import (
  "context"
  "errors"
  "io"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRejectsMissingTsgoBinary verifies the native wrapper refuses to
// start without an explicit upstream tsgo executable.
//
// The JavaScript launcher normally resolves typescript and
// passes TTSC_TSGO_BINARY. Direct native hosts need the same contract; otherwise
// ttscserver might accidentally run a stale tsgo from PATH.
//
// 1. Call RunLSPServer with Cwd set but no TsgoBinary.
// 2. Close editor input immediately so the proxy side can drain.
// 3. Assert ErrLSPTsgoBinaryRequired is returned.
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
