package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerFoldsUpstreamErrorAfterEditorExit Verifies that an editor-requested
// quit is not reported as a server failure.
//
// RunLSPServer suppresses its runner error when the proxy recorded editor exit.
// This controlled runner must independently receive exit before returning its
// error; the case does not measure native tsgo exit races or their frequency.
// TestLSPServerPropagatesRunnerError is the negative twin, pinning that the same
// runner error is still reported when no exit was requested.
//
//  1. Substitute an upstream runner that fails, but only after it has seen the
//     editor's `exit` notification arrive through the proxy.
//  2. Send `shutdown` and `exit` from the editor, then close the editor
//     stream. An `exit` no `shutdown` preceded is reported on its own
//     (TestLSPServerReportsExitWithoutShutdown), so the quit here is the clean
//     one.
//  3. Assert RunLSPServer returns nil rather than the runner's error.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer returns nil for the supplied runner failure after independently observed runner receipt of exit.
// @evidence contracts/testing.md#independent-expectations Shutdown/exit requires clean completion; a separate runner receipt channel rejects false success when upstream input closes before exit.
// @evidence contracts/testing.md#distinguishing-cases Exit-confirmed failure contrasts with no-exit error propagation.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPServerFoldsUpstreamErrorAfterEditorExit in test/driver invokes RunLSPServer with an injected in-process upstream runner. No native upstream artifact is built or started.
func TestLSPServerFoldsUpstreamErrorAfterEditorExit(t *testing.T) {
  sentinel := errors.New("tsgo --lsp --stdio: exit status 1")
  seenExit := make(chan struct{}, 1)
  // The server may also fold this error once the proxy recorded editor exit;
  // the independent receipt channel therefore owns the no-false-success check.
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
        seenExit <- struct{}{}
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

  for _, frame := range []string{
    `{"jsonrpc":"2.0","id":1,"method":"shutdown"}`,
    `{"jsonrpc":"2.0","method":"exit"}`,
  } {
    if err := driver.WriteFrame(editorInW, []byte(frame)); err != nil {
      t.Fatal(err)
    }
  }
  editorInW.Close()

  select {
  case err := <-done:
    if err != nil {
      t.Fatalf("an editor-requested exit must not report a server failure: %v", err)
    }
    select {
    case <-seenExit:
    default:
      t.Fatal("runner never received exit despite a successful server result")
    }
  case <-time.After(3 * time.Second):
    t.Fatal("RunLSPServer did not return")
  }
}
