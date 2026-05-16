package driver_test

import (
  "bytes"
  "context"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRunsWithTestUpstream wires the byte-level proxy onto a
// fake upstream runner so the orchestration logic in RunLSPServer can be
// pinned without booting tsgo's full LSP. The fake echoes editor traffic
// back through the pipes; the test asserts that a round-trip succeeds
// and that context cancellation produces a clean nil return.
//
// 1. Substitute a fake upstream that echoes every received frame.
// 2. Drive editor stdio over io.Pipe and a buffered sink.
// 3. Send one frame, observe the echo.
// 4. Cancel ctx; assert RunLSPServer returns nil.
func TestLSPServerRunsWithTestUpstream(t *testing.T) {
  echo := func(ctx context.Context, in io.Reader, out io.Writer, _ driver.LSPServerOptions) error {
    fr := driver.NewFrameReader(in)
    for {
      _, body, err := fr.Read()
      if err != nil {
        return err
      }
      if err := driver.WriteFrame(out, body); err != nil {
        return err
      }
      _ = ctx
    }
  }
  restore := driver.WithUpstreamRunnerForTest(echo)
  defer restore()

  editorInR, editorInW := io.Pipe()
  editorOutR, editorOutW := io.Pipe()
  ctx, cancel := context.WithCancel(context.Background())

  done := make(chan error, 1)
  go func() {
    done <- driver.RunLSPServer(ctx, driver.LSPServerOptions{
      In:  editorInR,
      Out: editorOutW,
      Err: io.Discard,
      Cwd: t.TempDir(),
    })
  }()

  payload := []byte(`{"jsonrpc":"2.0","method":"ping"}`)
  if err := driver.WriteFrame(editorInW, payload); err != nil {
    t.Fatal(err)
  }

  fr := driver.NewFrameReader(editorOutR)
  echoCh := make(chan []byte, 1)
  go func() {
    _, body, _ := fr.Read()
    echoCh <- body
  }()

  select {
  case body := <-echoCh:
    if !bytes.Equal(body, payload) {
      t.Fatalf("echo mismatch:\n%s", body)
    }
  case <-time.After(2 * time.Second):
    t.Fatal("echo did not arrive in 2s")
  }

  cancel()
  editorInW.Close()
  editorOutR.Close()

  select {
  case err := <-done:
    if err != nil {
      t.Fatalf("RunLSPServer errored: %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("RunLSPServer did not return after cancel")
  }
}
