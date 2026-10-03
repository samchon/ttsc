package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySkipsMalformedCodeActionRequest Verifies that a numeric-params action request and matching response both forward unchanged.
//
// The source would add an action, exposing erroneous bookkeeping for the malformed request.
//
// 1. Configure a source that would add an action.
// 2. Send a numeric-params action request and assert unchanged upstream forwarding.
// 3. Send its matching upstream response and assert unchanged editor forwarding.
//
// @evidence contracts/testing.md#behavioral-verification A numeric-params action request and matching response both forward unchanged.
// @evidence contracts/testing.md#independent-expectations Numeric params cannot describe the action request; original authored bytes define safe forwarding.
// @evidence contracts/testing.md#distinguishing-cases The source would add an action, exposing erroneous bookkeeping for the malformed request.
// @evidence contracts/testing.md#execution-ownership The Go pipe proxy receives a malformed request and synthetic matching response. Go discovers TestLSPProxySkipsMalformedCodeActionRequest under ./test/driver.
func TestLSPProxySkipsMalformedCodeActionRequest(t *testing.T) {
  source := &stubSource{
    actions: []driver.LSPCodeAction{{Title: "should-not-appear"}},
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":3,"method":"textDocument/codeAction","params":17}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("upstream did not see request:\n%s", got)
  }

  response := []byte(`{"jsonrpc":"2.0","id":3,"result":[]}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("response was augmented but should not be:\n%s", got)
  }
}
