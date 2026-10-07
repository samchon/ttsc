package driver_test

import (
  "bytes"
  "context"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRunsWithTestUpstream Verifies that RunLSPServer echoes the original frame through an injected runner and returns nil after cancellation.
//
// Successful echo precedes context cancellation and explicit pipe closure; pre-registered cleanup also cancels, closes all editor pipe ends and observes both worker exits within bounded waits.
//
// 1. Supply the in-process echo upstream and private editor pipes.
// 2. Send one frame and compare the echo to its original payload.
// 3. Cancel context, close the editor pipes, and assert the server returns nil.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer echoes the original frame through an injected runner and returns nil after cancellation.
// @evidence contracts/testing.md#independent-expectations The authored ping payload defines the echo, and cancellation requires clean termination.
// @evidence contracts/testing.md#distinguishing-cases Successful echo precedes context cancellation and explicit pipe closure; pre-registered cleanup also cancels, closes all editor pipe ends and observes both worker exits within bounded waits.
// @evidence contracts/testing.md#execution-ownership The upstream echo is an injected Go function; actual server orchestration runs over io.Pipe. Go discovers TestLSPServerRunsWithTestUpstream under ./test/driver.
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
  editorInR, editorInW := io.Pipe()
  editorOutR, editorOutW := io.Pipe()
  ctx, cancel := context.WithCancel(context.Background())
  cwd := t.TempDir()
  done := make(chan error, 1)
  runDone := make(chan struct{})
  echoDone := make(chan struct{})
  t.Cleanup(func() {
    cancel()
    editorInR.Close()
    editorInW.Close()
    editorOutR.Close()
    editorOutW.Close()
    select {
    case <-runDone:
    case <-time.After(3 * time.Second):
      t.Error("RunLSPServer did not finish after cleanup canceled and closed its pipes")
    }
    select {
    case <-echoDone:
    case <-time.After(3 * time.Second):
      t.Error("editor echo reader did not finish after cleanup closed its pipe")
    }
  })
  go func() {
    defer close(runDone)
    done <- driver.RunLSPServer(ctx, driver.LSPServerOptions{
      In:  editorInR,
      Out: editorOutW,
      Err: io.Discard,
      Cwd: cwd,
      Upstream: driver.LSPUpstream{
        Runner: echo,
      },
    })
  }()

  fr := driver.NewFrameReader(editorOutR)
  echoCh := make(chan []byte, 1)
  go func() {
    defer close(echoDone)
    _, body, _ := fr.Read()
    echoCh <- body
  }()

  payload := []byte(`{"jsonrpc":"2.0","method":"ping"}`)
  if err := driver.WriteFrame(editorInW, payload); err != nil {
    t.Fatal(err)
  }

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
