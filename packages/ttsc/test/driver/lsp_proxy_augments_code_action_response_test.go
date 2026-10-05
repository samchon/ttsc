package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyAugmentsCodeActionResponse Verifies the bookkeeping that
// pairs an editor codeAction request with the upstream response so ttsc
// can append plugin-owned actions. The proxy must remember the request
// uri/range/context when forwarding and then attach actions when the
// matching response arrives.
//
// 1. Configure a plugin action and require its request to reach upstream unchanged.
// 2. Return the upstream action for the same request id.
// 3. Require two actions retaining both authored titles.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards the request unchanged and returns a two-element result containing the upstream and plugin action titles.
// @evidence contracts/testing.md#independent-expectations Both action providers contribute independently authored titles; augmentation must preserve Add import while adding Apply ttsc lint fix.
// @evidence contracts/testing.md#distinguishing-cases A correlated nonempty upstream array and nonempty plugin result are covered; null and unaugmentable result shapes are separate cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver runs the real proxy using the pipe harness and stub actions, without an upstream server or installed plugin.
func TestLSPProxyAugmentsCodeActionResponse(t *testing.T) {
  source := &stubSource{
    actions: []driver.LSPCodeAction{
      {
        Title:   "Apply ttsc lint fix",
        Kind:    "quickfix",
        Command: &driver.LSPCommand{Title: "ttsc.lint.fix", Command: "ttsc.lint.fix"},
      },
    },
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":11,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":1,"character":0},"end":{"line":1,"character":5}},"context":{"diagnostics":[]}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); string(got) != string(request) {
    t.Fatalf("upstream did not see codeAction request:\n%s", got)
  }

  upstreamResp := []byte(`{"jsonrpc":"2.0","id":11,"result":[{"title":"Add import","kind":"quickfix"}]}`)
  h.sendUpstream(upstreamResp)
  body := h.recvEditor()

  if !strings.Contains(string(body), "Add import") {
    t.Fatalf("upstream action lost:\n%s", body)
  }
  if !strings.Contains(string(body), "Apply ttsc lint fix") {
    t.Fatalf("plugin action missing:\n%s", body)
  }
  var decoded struct {
    Result []json.RawMessage `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("merged code action body not JSON: %v", err)
  }
  if got := len(decoded.Result); got != 2 {
    t.Fatalf("expected 2 actions, got %d in %s", got, body)
  }
  var response struct {
    ID     int `json:"id"`
    Result []struct {
      Title string `json:"title"`
    } `json:"result"`
  }
  if err := json.Unmarshal(body, &response); err != nil {
    t.Fatalf("merged action titles not JSON: %v", err)
  }
  if response.ID != 11 || len(response.Result) != 2 || response.Result[0].Title != "Add import" || response.Result[1].Title != "Apply ttsc lint fix" {
    t.Fatalf("correlated result lost an authored action title:\n%s", body)
  }
}
