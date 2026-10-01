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

// TestLSPServerPrefersRunnerError pins the contract that the upstream
// tsgo server error wins over the proxy error in the final fold. A
// future refactor that swapped the order (or replaced the slice with
// errors.Join without an Is-aware unwrap) would silently flip the
// reported root cause and editors would see the wrong message.
//
// 1. Substitute an upstream runner that writes one frame upstream-to-editor and
//    then returns a `runnerSentinel` error.
// 2. Give the editor output a writer that fails with a different, unfolded
//    `proxySentinel`, so the proxy half also fails.
// 3. Assert RunLSPServer returns the runner sentinel, not the proxy sentinel.
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
