package driver_test

import (
  "context"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNewProxyDefaultsToNullSource verifies the constructor fallback:
// passing ProxyOptions.Source == nil must not panic on the first message
// the proxy sees. The cheapest proof is to construct the proxy with a
// nil source and feed it a publishDiagnostics frame — without a default
// source the proxy would dereference nil inside augmentUpstream.
//
// 1. Build a Proxy with Source: nil.
// 2. Run it against pipes.
// 3. Send a publishDiagnostics frame from upstream.
// 4. Assert the editor sees the same bytes (NullPluginSource contributes nothing).
func TestLSPNewProxyDefaultsToNullSource(t *testing.T) {
  edInR, edInW := io.Pipe()
  edOutR, edOutW := io.Pipe()
  upInR, upInW := io.Pipe()
  upOutR, upOutW := io.Pipe()
  t.Cleanup(func() {
    edInW.Close()
    edOutR.Close()
    upInR.Close()
    upOutW.Close()
    edInR.Close()
    edOutW.Close()
    upInW.Close()
    upOutR.Close()
  })

  proxy := driver.NewProxy(driver.ProxyOptions{
    EditorIn:    edInR,
    EditorOut:   edOutW,
    UpstreamIn:  upInW,
    UpstreamOut: upOutR,
    Source:      nil,
  })
  done := make(chan error, 1)
  go func() {
    done <- proxy.Run(context.Background())
  }()

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
