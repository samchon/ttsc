package driver_test

import (
  "context"
  "fmt"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerFoldsClosedPipeRunner pins the io.ErrClosedPipe continue
// branch. ttscserver treats a broken pipe as a graceful shutdown —
// editors that drop the stdio connection mid-session should not produce
// a non-zero exit from the launcher.
//
// 1. Substitute a runner that returns a wrapped io.ErrClosedPipe.
// 2. Drive editor pipes that close immediately so the proxy can drain.
// 3. Assert RunLSPServer returns nil.
func TestLSPServerFoldsClosedPipeRunner(t *testing.T) {
  runner := func(_ context.Context, _ io.Reader, _ io.Writer, _ driver.LSPServerOptions) error {
    return fmt.Errorf("upstream wrote to closed pipe: %w", io.ErrClosedPipe)
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
      t.Fatalf("expected nil for closed-pipe runner, got %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("RunLSPServer did not return")
  }
}
