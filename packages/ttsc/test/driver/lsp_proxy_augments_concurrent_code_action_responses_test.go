package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyAugmentsConcurrentCodeActionResponses Verifies that the proxy associates reverse-order action responses with each response ID's URI-tagged local action.
//
// Two outstanding requests receive reversed responses; the assertions do not separately require both distinct IDs exactly once.
//
// 1. Configure a source whose CodeActions returns a uri-tagged action.
// 2. Send codeAction requests id=1 (/a.ts) and id=2 (/b.ts).
// 3. Reply from upstream with id=2 first, then id=1.
// 4. Assert each editor response carries the action tagged with the matching uri.
//
// @evidence contracts/testing.md#behavioral-verification The proxy associates reverse-order action responses with each response ID's URI-tagged local action.
// @evidence contracts/testing.md#independent-expectations An authored ID-to-URI table defines expected titles independently of pendingActions.
// @evidence contracts/testing.md#distinguishing-cases Two outstanding requests receive reversed responses; the assertions do not separately require both distinct IDs exactly once.
// @evidence contracts/testing.md#execution-ownership Proxy.Run and synthetic upstream frames execute in the private Go pipe harness. Go discovers TestLSPProxyAugmentsConcurrentCodeActionResponses under ./test/driver.
func TestLSPProxyAugmentsConcurrentCodeActionResponses(t *testing.T) {
  source := &stubSource{
    actionsFor: func(uri string) []driver.LSPCodeAction {
      return []driver.LSPCodeAction{{Title: "fix-" + uri}}
    },
  }
  h := newProxyHarness(t, source)

  req1 := []byte(`{"jsonrpc":"2.0","id":1,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  req2 := []byte(`{"jsonrpc":"2.0","id":2,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///b.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  // io.Pipe is unbuffered, so we send each request, drain the proxy's
  // upstream forward, and only then queue the next request. This still
  // leaves both pending entries in the proxy when the responses arrive
  // out of order below.
  h.sendEditor(req1)
  _ = h.recvUpstream()
  h.sendEditor(req2)
  _ = h.recvUpstream()

  resp2 := []byte(`{"jsonrpc":"2.0","id":2,"result":[]}`)
  resp1 := []byte(`{"jsonrpc":"2.0","id":1,"result":[]}`)
  go func() {
    h.sendUpstream(resp2)
    h.sendUpstream(resp1)
  }()

  body1 := h.recvEditor()
  body2 := h.recvEditor()
  // Either order is fine — match on id then verify the uri-tagged action.
  if !strings.Contains(string(body1), `"id":2`) && !strings.Contains(string(body1), `"id":1`) {
    t.Fatalf("first editor frame missing recognized id:\n%s", body1)
  }
  bodies := [2][]byte{body1, body2}
  expect := map[int]string{1: "fix-file:///a.ts", 2: "fix-file:///b.ts"}
  for _, body := range bodies {
    var env struct {
      ID     int               `json:"id"`
      Result []json.RawMessage `json:"result"`
    }
    if err := json.Unmarshal(body, &env); err != nil {
      t.Fatalf("response not JSON: %v\n%s", err, body)
    }
    if env.ID != 1 && env.ID != 2 {
      t.Fatalf("unexpected response id %d in %s", env.ID, body)
    }
    if len(env.Result) != 1 {
      t.Fatalf("response id=%d expected 1 action, got %d in %s", env.ID, len(env.Result), body)
    }
    if !strings.Contains(string(env.Result[0]), expect[env.ID]) {
      t.Fatalf("response id=%d expected tagged %q, got %s", env.ID, expect[env.ID], env.Result[0])
    }
    var action struct {
      Title string `json:"title"`
    }
    if err := json.Unmarshal(env.Result[0], &action); err != nil {
      t.Fatalf("response id=%d action is not JSON: %v", env.ID, err)
    }
    if action.Title != expect[env.ID] {
      t.Fatalf("response id=%d expected exact title %q, got %q", env.ID, expect[env.ID], action.Title)
    }
  }
}
