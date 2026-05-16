package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerPropagatesRunnerError covers the error-fold path at the
// end of RunLSPServer. A failing upstream runner must produce a non-nil
// return so the launcher reports the failure to the editor host.
//
// 1. Substitute an upstream runner that returns a sentinel error.
// 2. Drive editor pipes that close immediately so the proxy exits cleanly.
// 3. Assert RunLSPServer returns the sentinel.
func TestLSPServerPropagatesRunnerError(t *testing.T) {
  sentinel := errors.New("upstream blew up")
  failing := func(_ context.Context, _ io.Reader, _ io.Writer, _ driver.LSPServerOptions) error {
    return sentinel
  }
  restore := driver.WithUpstreamRunnerForTest(failing)
  defer restore()

  editorInR, editorInW := io.Pipe()
  editorOutR, editorOutW := io.Pipe()
  defer editorInR.Close()
  defer editorOutW.Close()
  editorInW.Close() // proxy editor pump returns ErrFrameClosed immediately
  go io.Copy(io.Discard, editorOutR)

  done := make(chan error, 1)
  go func() {
    done <- driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
      In:  editorInR,
      Out: editorOutW,
      Err: io.Discard,
      Cwd: t.TempDir(),
    })
  }()

  select {
  case err := <-done:
    if !errors.Is(err, sentinel) {
      t.Fatalf("expected sentinel, got %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("RunLSPServer did not return")
  }
}
