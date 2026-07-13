package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySkipsIncompleteCodeActionRanges verifies missing LSP position
// fields are not normalized to zero before a native plugin sees the request.
//
// Incomplete ranges remain upstream's responsibility. The proxy must forward
// them verbatim and leave the matching response free of plugin augmentation.
//
//  1. Configure a source that would contribute a quick fix.
//  2. Send requests with missing, null, or reversed range fields.
//  3. Require each original request to reach upstream unchanged.
//  4. Require each upstream response to reach the editor unchanged.
func TestLSPProxySkipsIncompleteCodeActionRanges(t *testing.T) {
  cases := []struct {
    name     string
    request  []byte
    response []byte
  }{
    {
      name:     "missing range",
      request:  []byte(`{"jsonrpc":"2.0","id":31,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"context":{"diagnostics":[],"only":["quickfix"]}}}`),
      response: []byte(`{"jsonrpc":"2.0","id":31,"result":[]}`),
    },
    {
      name:     "missing start fields",
      request:  []byte(`{"jsonrpc":"2.0","id":32,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["quickfix"]}}}`),
      response: []byte(`{"jsonrpc":"2.0","id":32,"result":[]}`),
    },
    {
      name:     "missing start character",
      request:  []byte(`{"jsonrpc":"2.0","id":33,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["quickfix"]}}}`),
      response: []byte(`{"jsonrpc":"2.0","id":33,"result":[]}`),
    },
    {
      name:     "null end line",
      request:  []byte(`{"jsonrpc":"2.0","id":34,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":null,"character":1}},"context":{"diagnostics":[],"only":["quickfix"]}}}`),
      response: []byte(`{"jsonrpc":"2.0","id":34,"result":[]}`),
    },
    {
      name:     "reversed range",
      request:  []byte(`{"jsonrpc":"2.0","id":35,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":1,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["quickfix"]}}}`),
      response: []byte(`{"jsonrpc":"2.0","id":35,"result":[]}`),
    },
  }
  source := &stubSource{
    actions:         []driver.LSPCodeAction{{Title: "should-not-appear", Kind: "quickfix.ttsc"}},
    codeActionKinds: []string{"quickfix.ttsc"},
  }
  h := newProxyHarness(t, source)
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      h.sendEditor(tc.request)
      if got := h.recvUpstream(); !bytes.Equal(got, tc.request) {
        t.Fatalf("upstream did not see request:\n%s", got)
      }
      h.sendUpstream(tc.response)
      if got := h.recvEditor(); !bytes.Equal(got, tc.response) {
        t.Fatalf("response was augmented but should not be:\n%s", got)
      }
    })
  }
}
