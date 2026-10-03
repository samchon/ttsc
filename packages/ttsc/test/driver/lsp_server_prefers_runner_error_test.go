package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// failingEditorOut is an editor output whose every write fails with err.
type failingEditorOut struct{ err error }

func (w failingEditorOut) Write([]byte) (int, error) { return 0, w.err }

// TestLSPServerPrefersRunnerError Verifies that RunLSPServer prefers the runner sentinel over a distinct editor-write sentinel.
//
// The runner writes a valid frame before failing while editor output also fails.
//
// 1. Substitute an upstream runner that writes one frame upstream-to-editor and then returns a `runnerSentinel` error.
// 2. Give the editor output a writer that fails with a different, unfolded `proxySentinel`, so the proxy half also fails.
// 3. Assert RunLSPServer returns the runner sentinel, not the proxy sentinel.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer prefers the runner sentinel over a distinct editor-write sentinel.
// @evidence contracts/testing.md#independent-expectations Separately authored errors identify the competing failures independently of folding.
// @evidence contracts/testing.md#distinguishing-cases The runner writes a valid frame before failing while editor output also fails.
// @evidence contracts/testing.md#execution-ownership An injected Go runner and failing writer exercise server orchestration without booting tsgo. Go discovers TestLSPServerPrefersRunnerError under ./test/driver.
func TestLSPServerPrefersRunnerError(t *testing.T) {
  runnerSentinel := errors.New("synthetic upstream failure")
  proxySentinel := errors.New("synthetic editor write failure")
  runner := func(_ context.Context, _ io.Reader, out io.Writer, _ driver.LSPServerOptions) error {
    // The pipe write returns only after the proxy has read the frame, so the
    // proxy's failing editor write is already under way when the runner fails.
    if err := driver.WriteFrame(out, []byte(`{"jsonrpc":"2.0","method":"window/logMessage","params":{}}`)); err != nil {
      return err
    }
    return runnerSentinel
  }

  editorInR, editorInW := io.Pipe()
  defer editorInR.Close()
  defer editorInW.Close()

  done := make(chan error, 1)
  go func() {
    done <- driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
      In:  editorInR,
      Out: failingEditorOut{err: proxySentinel},
      Err: io.Discard,
      Cwd: t.TempDir(),
      Upstream: driver.LSPUpstream{
        Runner: runner,
      },
    })
  }()

  select {
  case err := <-done:
    if errors.Is(err, proxySentinel) {
      t.Fatalf("proxy error won over the runner error: %v", err)
    }
    if !errors.Is(err, runnerSentinel) {
      t.Fatalf("expected runner sentinel to win, got %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("RunLSPServer did not return")
  }
}
