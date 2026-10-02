package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyPreservesSlowUpstreamCodeActions Verifies plugin actions do not
// race out ahead of a slow upstream response.
//
// LSP responses are single-shot. If ttsc answers before tsgo, the later
// upstream result must be dropped and TypeScript quick fixes disappear. The
// proxy therefore waits for upstream whenever upstream advertised code-action
// support, then appends plugin actions to that response.
//
// 1. Configure one plugin action.
// 2. Send a normal codeAction request and drain it upstream; the proxy holds the
//    request open until upstream replies (no wall-clock delay is injected).
// 3. Reply from upstream with a TypeScript action.
// 4. Assert the observed editor response holds both the upstream and plugin
//    actions (two entries).
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns a two-element action array containing both Add missing import and ttsc fix after the upstream response arrives.
// @evidence contracts/testing.md#independent-expectations One response must preserve both independently authored action contributions rather than discard the upstream fix.
// @evidence contracts/testing.md#distinguishing-cases Upstream response order is controlled by the test, without an injected wall-clock delay or an explicit earlier no-response assertion.
// @evidence contracts/testing.md#execution-ownership The Go test/driver pipe harness exercises request correlation and merge using a stub source and simulated upstream frames.
func TestLSPProxyPreservesSlowUpstreamCodeActions(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    actions: []driver.LSPCodeAction{{Title: "ttsc fix", Kind: "source.fixAll.ttsc"}},
  })

  req := []byte(`{"jsonrpc":"2.0","id":4,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[]}}}`)
  h.sendEditor(req)
  _ = h.recvUpstream()

  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":4,"result":[{"title":"Add missing import","kind":"quickfix"}]}`))
  body := h.recvEditor()
  if !strings.Contains(string(body), "Add missing import") || !strings.Contains(string(body), "ttsc fix") {
    t.Fatalf("code actions were not merged:\n%s", body)
  }
  var decoded struct {
    Result []json.RawMessage `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("response not JSON: %v\n%s", err, body)
  }
  if len(decoded.Result) != 2 {
    t.Fatalf("expected 2 merged actions, got %d in %s", len(decoded.Result), body)
  }
}
