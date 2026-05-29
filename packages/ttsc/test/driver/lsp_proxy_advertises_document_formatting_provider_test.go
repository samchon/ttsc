package driver_test

import (
  "encoding/json"
  "testing"
)

// TestLSPProxyAdvertisesDocumentFormattingProvider verifies the initialize
// augmentation advertises documentFormattingProvider when ttsc owns
// ttsc.format.document, so editors send textDocument/formatting (formatOnSave)
// that the proxy intercepts and routes through the buffer formatter.
//
// 1. Configure a source that owns ttsc.format.document.
// 2. Reply from upstream with capabilities that omit documentFormattingProvider.
// 3. Assert the editor sees documentFormattingProvider true.
func TestLSPProxyAdvertisesDocumentFormattingProvider(t *testing.T) {
  h := newProxyHarness(t, &stubSource{commands: []string{"ttsc.format.document"}})

  request := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); string(got) != string(request) {
    t.Fatalf("upstream did not see initialize request:\n%s", got)
  }

  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":true}}}`))
  body := h.recvEditor()
  var decoded struct {
    Result struct {
      Capabilities struct {
        DocumentFormattingProvider bool `json:"documentFormattingProvider"`
      } `json:"capabilities"`
    } `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("initialize response not JSON: %v\n%s", err, body)
  }
  if !decoded.Result.Capabilities.DocumentFormattingProvider {
    t.Fatalf("documentFormattingProvider was not advertised:\n%s", body)
  }
}
