package driver_test

import (
  "context"
  "encoding/json"
  "io"
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
// @evidence contracts/testing.md#execution-ownership TestLSPServerDefaultRunnerConstructsRealServer directly runs RunLSPServer with the selected workspace tsgo child and joins the host/reader through cleanup, without a built product CLI. Binary discovery may also launch the helper's Node resolver when TTSC_TSGO_BINARY is absent; this is not a total child-count or loaded-image certificate.
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
      if err != nil {
        t.Errorf("RunLSPServer should shut down cleanly, got %v", err)
      }
    case <-time.After(10 * time.Second):
      t.Error("RunLSPServer did not return after cancel")
    }
    select {
    case <-readerDone:
    case <-time.After(10 * time.Second):
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
      case <-ctx.Done():
        return
      }
      if err != nil {
        return
      }
    }
  }()

  initialize := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":null,"capabilities":{}}}`)
  if err := driver.WriteFrame(editorInW, initialize); err != nil {
    t.Fatal(err)
  }

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
      if string(env.ID) != "1" {
        continue
      }
      var result map[string]json.RawMessage
      if err := json.Unmarshal(env.Result, &result); err != nil {
        continue
      }
      var capabilities map[string]json.RawMessage
      if err := json.Unmarshal(result["capabilities"], &capabilities); err != nil || capabilities == nil {
        continue
      }
      initialized = true
    case <-deadline:
      t.Fatal("initialize response did not arrive in 10s")
    }
  }

}
