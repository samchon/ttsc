package driver_test

import (
  "context"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNewProxyDefaultsToNullSource Verifies the constructor fallback:
// passing ProxyOptions.Source == nil must not panic on the first message
// the proxy sees. The test feeds an upstream diagnostic publication and
// requires the original body bytes from the editor pipe. It does not observe
// any additional publication after that first frame.
//
// 1. Build a Proxy with Source: nil.
// 2. Run it against pipes.
// 3. Send a publishDiagnostics frame from upstream.
// 4. Assert the editor sees the same bytes (NullPluginSource contributes nothing).
//
// @evidence contracts/testing.md#behavioral-verification NewProxy with nil Source forwards publishDiagnostics body bytes unchanged through Proxy.Run.
// @evidence contracts/testing.md#independent-expectations A nil source means no plugin contribution, so the authored upstream body must arrive intact; no-frame behavior beyond the first result is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The constructor fallback is exercised by a diagnostic publication that would otherwise dereference a source; explicit sources have separate cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver runs the byte proxy over io.Pipe endpoints; no editor, tsgo executable or plugin sidecar is started.
func TestLSPNewProxyDefaultsToNullSource(t *testing.T) {
  edInR, edInW := io.Pipe()
  edOutR, edOutW := io.Pipe()
  upInR, upInW := io.Pipe()
  upOutR, upOutW := io.Pipe()
  ctx, cancel := context.WithCancel(context.Background())
  done := make(chan error, 1)
  closePipes := func() {
    cancel()
    edInW.Close()
    edOutR.Close()
    upInR.Close()
    upOutW.Close()
    edInR.Close()
    edOutW.Close()
    upInW.Close()
    upOutR.Close()
  }
  t.Cleanup(closePipes)

  proxy := driver.NewProxy(driver.ProxyOptions{
    EditorIn:    edInR,
    EditorOut:   edOutW,
    UpstreamIn:  upInW,
    UpstreamOut: upOutR,
    Source:      nil,
  })
  go func() {
    done <- proxy.Run(ctx)
  }()
  t.Cleanup(func() {
    closePipes()
    select {
    case <-done:
    case <-time.After(3 * time.Second):
      t.Error("proxy.Run did not finish during cleanup")
    }
  })

  body := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///x.ts","diagnostics":[]}}`)
  if err := driver.WriteFrame(upOutW, body); err != nil {
    t.Fatal(err)
  }
  fr := driver.NewFrameReader(edOutR)

  type result struct {
    body []byte
    err  error
  }
  got := make(chan result, 1)
  go func() {
    _, b, err := fr.Read()
    got <- result{b, err}
  }()

  select {
  case r := <-got:
    if r.err != nil {
      t.Fatalf("editor read errored: %v", r.err)
    }
    if string(r.body) != string(body) {
      t.Fatalf("default null source rewrote frame:\n%s", r.body)
    }
  case <-time.After(2 * time.Second):
    t.Fatal("editor never received the forwarded frame")
  }
}
