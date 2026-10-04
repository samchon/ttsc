package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsNonArrayCodeActionResult Verifies the result-shape
// guard in appendCodeActions using an authored id-correlated object result.
// Cancellation and request-ID reuse are not exercised. The guard preserves
// this object instead of replacing it with a plugin action array.
//
// 1. Configure a source that would contribute an action.
// 2. Send a codeAction request and drain it upstream.
// 3. Reply with id-matching response whose result is an object (e.g. hover).
// 4. Assert the editor receives the object response unmodified.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards the correlated object result byte-for-byte instead of replacing it with a plugin action array.
// @evidence contracts/testing.md#independent-expectations A foreign object result must keep its shape and contents; literal hover-text response bytes detect accidental array augmentation.
// @evidence contracts/testing.md#distinguishing-cases An id-correlated codeAction request followed by an object result owns the result-shape guard; this body does not cancel or reuse the id.
// @evidence contracts/testing.md#execution-ownership Go test/driver executes the pipe proxy with a configured stub action and authored frames, without upstream process execution.
func TestLSPProxyForwardsNonArrayCodeActionResult(t *testing.T) {
  source := &stubSource{actions: []driver.LSPCodeAction{{Title: "ignored"}}}
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":7,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///x.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  _ = h.recvUpstream()

  response := []byte(`{"jsonrpc":"2.0","id":7,"result":{"contents":"hover-text"}}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("non-array result was augmented:\n%s", got)
  }
}
