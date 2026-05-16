package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyAugmentsConcurrentCodeActionResponses verifies the proxy
// correlates concurrent codeAction round-trips by id. Real editors
// routinely have multiple in-flight requests during keystroke-driven
// activity; pendingActions must key on the id alone and survive the
// upstream returning responses in reverse order from the requests.
//
// Locks the per-id keying in pendingActions and the lock contract in
// rememberCodeActionRequest / augmentUpstream. A future refactor that
// moved the delete outside the critical section would silently swap
// the uri/range/ctx of two interleaved requests without this test.
//
// 1. Configure a source whose CodeActions returns a uri-tagged action.
// 2. Send codeAction requests id=1 (/a.ts) and id=2 (/b.ts).
// 3. Reply from upstream with id=2 first, then id=1.
// 4. Assert each editor response carries the action tagged with the matching uri.
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
  }
}
