package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerReportsExitWithoutShutdown Verifies the status the LSP
// specification gives an `exit` that no `shutdown` request preceded.
//
// The specification ends the server with status 0 when `shutdown` came before
// `exit` and 1 when it did not. RunLSPServer reports the
// second case as ErrLSPExitWithoutShutdown, which ttscserver turns into status
// 1; TestLSPServerEndsTheSessionOnExitWithoutTheEditorsEOF is the twin that
// sends `shutdown` first and gets nil.
//
//  1. Give RunLSPServer an editor input that never ends, and an upstream that
//     returns on `exit`.
//  2. Send only `exit`.
//  3. Assert RunLSPServer returns ErrLSPExitWithoutShutdown promptly.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer returns ErrLSPExitWithoutShutdown promptly with uncloseable input.
// @evidence contracts/testing.md#independent-expectations LSP exit without prior shutdown requires the unsuccessful-exit API outcome.
// @evidence contracts/testing.md#distinguishing-cases Exit-only contrasts with the shutdown/exit companion.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPServerReportsExitWithoutShutdown in test/driver invokes RunLSPServer with an injected in-process upstream runner. No native upstream artifact is built or started.
func TestLSPServerReportsExitWithoutShutdown(t *testing.T) {
  editorInR, editorInW := io.Pipe()
  defer editorInW.Close()
  editorOutR, editorOutW := io.Pipe()
  defer editorOutW.Close()
  go io.Copy(io.Discard, editorOutR)

  done := make(chan error, 1)
  go func() {
    done <- driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
      In:       uncloseableReader{editorInR},
      Out:      editorOutW,
      Err:      io.Discard,
      Cwd:      t.TempDir(),
      Upstream: driver.LSPUpstream{Runner: tsgoLikeUpstream},
    })
  }()

  if err := driver.WriteFrame(editorInW, []byte(`{"jsonrpc":"2.0","method":"exit"}`)); err != nil {
    t.Fatal(err)
  }

  select {
  case err := <-done:
    if !errors.Is(err, driver.ErrLSPExitWithoutShutdown) {
      t.Fatalf("an exit no shutdown preceded must be reported, got %v", err)
    }
  case <-time.After(5 * time.Second):
    t.Fatal("RunLSPServer kept running after exit while the editor's stream stayed open")
  }
}
