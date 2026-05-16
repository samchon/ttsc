package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySkipsMalformedCodeActionRequest pins the "remember" path's
// safety net: a codeAction request whose params cannot be decoded must
// be forwarded upstream verbatim and must not be recorded, so the
// matching upstream response is not erroneously augmented.
//
// 1. Configure a source that would contribute an action.
// 2. Send a request whose params decode fails (params is a number).
// 3. Forward the request upstream.
// 4. Send the matching response from upstream.
// 5. Assert the editor sees the response unmodified.
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
