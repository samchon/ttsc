package driver_test

import (
  "context"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerFoldsContextCanceledRunner Verifies that RunLSPServer folds context.Canceled from its runner into nil.
//
// Immediate editor EOF and cancelled-runner completion exercise the fold.
//
// 1. Substitute an upstream runner that returns context.Canceled.
// 2. Drive editor pipes that close immediately.
// 3. Assert RunLSPServer returns nil.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer folds context.Canceled from its runner into nil.
// @evidence contracts/testing.md#independent-expectations The injected runner returns the standard cancellation sentinel independently of orchestration.
// @evidence contracts/testing.md#distinguishing-cases Immediate editor EOF and cancelled-runner completion exercise the fold.
// @evidence contracts/testing.md#execution-ownership The public Go server uses an injected runner and private pipes and joins its done result. Go discovers TestLSPServerFoldsContextCanceledRunner under ./test/driver.
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
