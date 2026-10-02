//go:build e2e

package driver_test

import (
  "context"
  "encoding/json"
  "io"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerDefaultRunnerConstructsRealServer verifies the production
// path where defaultUpstreamRunner starts a real `tsgo --lsp --stdio` process and
// drives a minimal initialize round-trip through the proxy. Booting the
// stack and immediately cancelling would still pass if the process never
// answered; sending initialize forces the upstream LSP server to prove it
// is really running behind the proxy.
//
// 1. Call RunLSPServer with a temp directory as Cwd (no runner override).
// 2. Send a real initialize request.
// 3. Read the response and assert it carries server capabilities.
// 4. Cancel + close editor pipes; assert RunLSPServer returns nil.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer starts the actual installed compiler with no runner injection and answers initialize ID 1 with capabilities, then cancellation returns nil and both host and editor reader join.
// @evidence contracts/testing.md#independent-expectations A real LSP initialize response, rather than process startup alone, proves the upstream protocol connection; literal request ID ties the response to this exchange.
// @evidence contracts/testing.md#distinguishing-cases The live handshake complements command EOF-only smoke cases. Non-response, early read failure and unjoined cancellation fail this test.
// @evidence contracts/testing.md#execution-ownership TestLSPServerDefaultRunnerConstructsRealServer is its own Go E2E entry selected by the central ttsc experiment and built only with -tags=e2e; all assertions and failure messages remain with this discoverable function.
// @evidence contracts/e2e.md#necessary-boundary The public LSP proxy uses its production default runner to communicate with the installed tsgo process; an injected upstream cannot establish default process wiring.
// @evidence contracts/e2e.md#shared-execution This sole default-runner connection starts one real compiler session and performs one initialize exchange. The installed SDK is resolved through the existing compiler package; no compiler artifact is built by this case.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Its fresh cwd and editor pipes belong to the case. Cleanup cancels the context and closes both ends of both pipes even after assertion failure. Separate ten-second waits require host and reader completion and report failure if either does not join; the reader send observes cancellation so surplus messages cannot prevent its join. It exercises no cache invalidation.
// @evidence contracts/e2e.md#preserved-coverage The original real-server initialize exchange and clean cancellation remain in this case. The response now must carry request ID 1 as well as capabilities; registered cleanup also requires the host and editor reader to finish. No fixture sidecar participates in this connection and no direct-unit assertion is claimed as proof of the installed server.
func TestLSPServerDefaultRunnerConstructsRealServer(t *testing.T) {
  cwd := t.TempDir()
  binary := tsgoBinaryForTest(t)
  editorInR, editorInW := io.Pipe()
  editorOutR, editorOutW := io.Pipe()
  ctx, cancel := context.WithCancel(context.Background())
  done := make(chan error, 1)
  readerDone := make(chan struct{})
  t.Cleanup(func() {
    cancel()
    editorInW.Close()
    editorInR.Close()
    editorOutR.Close()
    editorOutW.Close()
    select {
    case err := <-done:
      if err != nil { t.Errorf("RunLSPServer should shut down cleanly, got %v", err) }
    case <-time.After(10*time.Second):
      t.Error("RunLSPServer did not return after cancel")
    }
    select {
    case <-readerDone:
    case <-time.After(10*time.Second):
      t.Error("editor reader did not return after pipes closed")
    }
  })
  go func() {
    done <- driver.RunLSPServer(ctx, driver.LSPServerOptions{
      In:         editorInR,
      Out:        editorOutW,
      Err:        io.Discard,
      Cwd:        cwd,
      TsgoBinary: binary,
    })
  }()

  type readResult struct {
    body []byte
    err  error
  }
  reader := driver.NewFrameReader(editorOutR)
  resultCh := make(chan readResult, 4)
  go func() {
    defer close(readerDone)
    for {
      _, body, err := reader.Read()
      select {
      case resultCh <- readResult{body, err}:
      case <-ctx.Done(): return
      }
      if err != nil {
        return
      }
    }
  }()

  initialize := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":null,"capabilities":{}}}`)
  if err := driver.WriteFrame(editorInW, initialize); err != nil { t.Fatal(err) }

  deadline := time.After(10 * time.Second)
  initialized := false
  for !initialized {
    select {
    case r := <-resultCh:
      if r.err != nil {
        t.Fatalf("editor read errored before initialize response: %v", r.err)
      }
      var env struct {
        ID     json.RawMessage `json:"id"`
        Result json.RawMessage `json:"result"`
      }
      if err := json.Unmarshal(r.body, &env); err != nil {
        continue
      }
      if string(env.ID) != "1" || !strings.Contains(string(env.Result), `"capabilities"`) {
        continue
      }
      initialized = true
    case <-deadline:
      t.Fatal("initialize response did not arrive in 10s")
    }
  }

}
