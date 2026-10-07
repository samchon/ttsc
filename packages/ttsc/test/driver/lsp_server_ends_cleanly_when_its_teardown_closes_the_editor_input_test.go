package driver_test

import (
  "context"
  "io"
  "os"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// closingEditorInput is an editor input whose Close ends a pending read with
// os.ErrClosed, as closing an *os.File stdin does to a read it interrupts or
// one that starts after it.
type closingEditorInput struct {
  r *io.PipeReader
  w *io.PipeWriter
}

func (in closingEditorInput) Read(p []byte) (int, error) { return in.r.Read(p) }

func (in closingEditorInput) Close() error {
  return in.w.CloseWithError(os.ErrClosed)
}

// TestLSPServerEndsCleanlyWhenItsTeardownClosesTheEditorInput Verifies that RunLSPServer returns nil after shutdown and exit even when teardown closes input with os.ErrClosed.
//
// Fifty sessions vary scheduling; success does not prove every teardown ordering occurred.
//
// 1. Provide the closed-file-error editor input and in-process shutdown/exit runner.
// 2. Send shutdown then exit without closing editor input.
// 3. Repeat fifty sessions and assert each server invocation returns nil.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer returns nil after shutdown and exit even when teardown closes input with os.ErrClosed.
// @evidence contracts/testing.md#independent-expectations The custom reader reproduces closed-file input failure, which clean teardown must fold.
// @evidence contracts/testing.md#distinguishing-cases Fifty sessions vary scheduling; success does not prove every teardown ordering occurred.
// @evidence contracts/testing.md#execution-ownership An injected tsgoLikeUpstream runs in Go over pipes; no native LSP server starts. Go discovers TestLSPServerEndsCleanlyWhenItsTeardownClosesTheEditorInput under ./test/driver.
func TestLSPServerEndsCleanlyWhenItsTeardownClosesTheEditorInput(t *testing.T) {
  for session := 0; session < 50; session++ {
    editorInR, editorInW := io.Pipe()
    editorOutR, editorOutW := io.Pipe()
    go func() { _, _ = io.Copy(io.Discard, editorOutR) }()

    done := make(chan error, 1)
    go func() {
      done <- driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
        In:       closingEditorInput{r: editorInR, w: editorInW},
        Out:      editorOutW,
        Err:      io.Discard,
        Cwd:      t.TempDir(),
        Upstream: driver.LSPUpstream{Runner: tsgoLikeUpstream},
      })
    }()
    for _, frame := range []string{
      `{"jsonrpc":"2.0","id":1,"method":"shutdown"}`,
      `{"jsonrpc":"2.0","method":"exit"}`,
    } {
      if err := driver.WriteFrame(editorInW, []byte(frame)); err != nil {
        t.Fatal(err)
      }
    }
    select {
    case err := <-done:
      if err != nil {
        t.Fatalf("session %d: exit after shutdown must end cleanly, got %v", session, err)
      }
    case <-time.After(5 * time.Second):
      t.Fatalf("session %d: RunLSPServer kept running after exit", session)
    }
    editorOutW.Close()
  }
}
