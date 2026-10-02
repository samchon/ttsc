package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRunReportsEditorWriteError Verifies pumpUpstreamToEditor's
// malformed-envelope forward path: a non-JSON upstream frame must surface a
// write error when the editor closes its read end mid-session. The
// augmented-frame forward path is covered by
// TestLSPProxyRunReportsEditorAugmentedWriteError.
//
// The authored non-JSON body and closed reader independently choose the failure branch.
//
//  1. Build a proxy with EditorOut closed on the editor side.
//  2. Send a malformed upstream frame so the pump takes the parse-error
//     branch into the failing write.
//  3. Assert the proxy returns a wrapped io.ErrClosedPipe error.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns io.ErrClosedPipe within three seconds for malformed-frame forwarding to a closed editor.
// @evidence contracts/testing.md#independent-expectations The authored non-JSON body and closed reader independently choose the failure branch.
// @evidence contracts/testing.md#distinguishing-cases Malformed envelope forwarding failure differs from augmented writes.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyRunReportsEditorWriteError in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyRunReportsEditorWriteError(t *testing.T) {
  edInR, edInW := io.Pipe()
  edOutR, edOutW := io.Pipe()
  upInR, upInW := io.Pipe()
  upOutR, upOutW := io.Pipe()
  t.Cleanup(func() {
    edInR.Close()
    edInW.Close()
    edOutR.Close()
    edOutW.Close()
    upInR.Close()
    upInW.Close()
    upOutR.Close()
    upOutW.Close()
  })

  // Editor consumer disappears.
  edOutR.Close()
  // Editor producer ends cleanly so the editor pump returns ErrFrameClosed.
  edInW.Close()
  // Upstream consumer end is fine; we never block on it.

  proxy := driver.NewProxy(driver.ProxyOptions{
    EditorIn:    edInR,
    EditorOut:   edOutW,
    UpstreamIn:  upInW,
    UpstreamOut: upOutR,
    Source:      nil,
  })
  done := make(chan error, 1)
  go func() { done <- proxy.Run(context.Background()) }()

  if err := driver.WriteFrame(upOutW, []byte("non-json body")); err != nil {
    t.Fatal(err)
  }

  select {
  case err := <-done:
    if err == nil {
      t.Fatal("expected error from broken editor pipe")
    }
    if !errors.Is(err, io.ErrClosedPipe) {
      t.Fatalf("expected io.ErrClosedPipe, got %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("proxy.Run did not return after editor pipe break")
  }
}
