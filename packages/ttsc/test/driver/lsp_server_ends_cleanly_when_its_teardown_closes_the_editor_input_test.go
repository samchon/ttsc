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

// TestLSPServerEndsCleanlyWhenItsTeardownClosesTheEditorInput pins that the
// session an `exit` after `shutdown` ends reports no error when RunLSPServer's
// own teardown closes the editor's input.
//
// When the session ends, RunLSPServer closes the editor input it was given, and
// a read on a closed stdin fails with os.ErrClosed ("file already closed").
// Since the session stopped waiting for the editor's EOF after `exit`
// (samchon/ttsc#1575), that read can finish before the upstream is seen to end,
// and it was reported as the session's failure: ttscserver exited with status 1
// after a clean `shutdown` and `exit`, in about one run of four on Windows.
//
//  1. Give RunLSPServer an editor input that its Close ends with os.ErrClosed,
//     and an upstream that answers `shutdown` and returns on `exit`.
//  2. Send `shutdown`, then `exit`, and keep the input open.
//  3. Assert RunLSPServer returns nil, over enough sessions that both orders of
//     the two ends occur.
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
