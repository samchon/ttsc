package driver_test

import (
  "context"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerFoldsContextCanceledRunner pins the context.Canceled
// continue branch in RunLSPServer's error fold. A runner that returns
// context.Canceled must not surface as an error — editor shutdown should
// look like clean nil to the caller.
//
// 1. Substitute an upstream runner that returns context.Canceled.
// 2. Drive editor pipes that close immediately.
// 3. Assert RunLSPServer returns nil.
func TestLSPServerFoldsContextCanceledRunner(t *testing.T) {
  runner := func(_ context.Context, _ io.Reader, _ io.Writer, _ driver.LSPServerOptions) error {
    return context.Canceled
  }
  editorInR, editorInW := io.Pipe()
  editorOutR, editorOutW := io.Pipe()
  defer editorInR.Close()
  defer editorOutW.Close()
  editorInW.Close()
  go io.Copy(io.Discard, editorOutR)

  done := make(chan error, 1)
  go func() {
    done <- driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
      In:  editorInR,
      Out: editorOutW,
      Err: io.Discard,
      Cwd: t.TempDir(),
      Upstream: driver.LSPUpstream{
        Runner: runner,
      },
    })
  }()

  select {
  case err := <-done:
    if err != nil {
      t.Fatalf("expected nil for canceled runner, got %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("RunLSPServer did not return")
  }
}
