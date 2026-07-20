package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerFoldsUpstreamErrorAfterEditorExit pins that an editor-requested
// quit is not reported as a server failure.
//
// tsgo's `exit` handler returns io.EOF, which cancels its dispatch loop, and
// whether its process then ends 0 or 1 depends on whether that cancellation or
// the editor's closed stdin reaches its errgroup first. Both outcomes are the
// same clean quit from the editor's side, so RunLSPServer must not turn the
// losing side of that race into a failed server: a VS Code user quitting would
// otherwise see a server crash on roughly every other quit.
// TestLSPServerPropagatesRunnerError is the negative twin, pinning that the same
// runner error is still reported when no exit was requested.
//
//  1. Substitute an upstream runner that fails, but only after it has seen the
//     editor's `exit` notification arrive through the proxy.
//  2. Send `exit` from the editor, then close the editor stream.
//  3. Assert RunLSPServer returns nil rather than the runner's error.
func TestLSPServerFoldsUpstreamErrorAfterEditorExit(t *testing.T) {
  sentinel := errors.New("tsgo --lsp --stdio: exit status 1")
  // Returned when the runner's stream ends before any exit arrives. It must be
  // an error RunLSPServer reports rather than folds: ErrFrameClosed is folded
  // unconditionally, so returning the raw read error would let this test pass
  // without the exit ever having been seen.
  missed := errors.New("the exit notification never reached the runner")
  failAfterExit := func(_ context.Context, in io.Reader, _ io.Writer, _ driver.LSPServerOptions) error {
    fr := driver.NewFrameReader(in)
    for {
      _, body, err := fr.Read()
      if err != nil {
        return missed
      }
      env, parseErr := driver.ParseEnvelope(body)
      if parseErr == nil && env.Method == "exit" {
        return sentinel
      }
    }
  }

  editorInR, editorInW := io.Pipe()
  editorOutR, editorOutW := io.Pipe()
  defer editorInR.Close()
  defer editorOutW.Close()
  go io.Copy(io.Discard, editorOutR)

  done := make(chan error, 1)
  go func() {
    done <- driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
      In:  editorInR,
      Out: editorOutW,
      Err: io.Discard,
      Cwd: t.TempDir(),
      Upstream: driver.LSPUpstream{
        Runner: failAfterExit,
      },
    })
  }()

  if err := driver.WriteFrame(editorInW, []byte(`{"jsonrpc":"2.0","method":"exit"}`)); err != nil {
    t.Fatal(err)
  }
  editorInW.Close()

  select {
  case err := <-done:
    if err != nil {
      t.Fatalf("an editor-requested exit must not report a server failure: %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("RunLSPServer did not return")
  }
}
