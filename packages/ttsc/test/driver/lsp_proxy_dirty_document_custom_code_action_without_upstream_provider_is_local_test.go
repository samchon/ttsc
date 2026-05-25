package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDirtyDocumentCustomCodeActionWithoutUpstreamProviderIsLocal verifies
// dirty-document action suppression honors upstream capability state.
//
// When upstream advertised `codeActionProvider: false`, even a non-ttsc custom
// `context.only` request has nowhere useful to forward. The proxy should return
// an empty local result instead of leaking the request upstream.
//
// 1. Initialize with upstream code actions disabled.
// 2. Mark a document dirty.
// 3. Request a custom source action.
// 4. Assert the result is empty and no upstream frame is sent.
func TestLSPProxyDirtyDocumentCustomCodeActionWithoutUpstreamProviderIsLocal(t *testing.T) {
  h := newProxyHarness(t, &stubSource{})
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":false}}}`))
  _ = h.recvEditor()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const dirty = 1;"}]}}`))
  _ = h.recvUpstream()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":2,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.custom"]}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  body := h.recvEditor()
  var decoded struct {
    Result []driver.LSPCodeAction `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("code action response not JSON: %v\n%s", err, body)
  }
  if len(decoded.Result) != 0 {
    t.Fatalf("dirty custom actions were not suppressed: %#v", decoded.Result)
  }
}
