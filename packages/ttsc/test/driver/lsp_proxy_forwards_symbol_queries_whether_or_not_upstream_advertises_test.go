package driver_test

import (
  "encoding/json"
  "strconv"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsSymbolQueriesWhetherOrNotUpstreamAdvertises Verifies that
// documentSymbol and references belong to the upstream server: the proxy
// forwards both requests verbatim and passes upstream's capability values to the
// editor unchanged, whether upstream advertised the methods or not.
//
// The proxy once answered both methods from a compiler-backed graph when
// upstream did not advertise them, and advertised the capabilities itself in
// that case. The not-advertised case is the one that behavior would have
// changed: the capability would have appeared and the requests would have been
// answered locally instead of reaching upstream.
//
//  1. Complete an initialize handshake whose upstream result either advertises
//     both capabilities or advertises neither.
//  2. Assert the editor receives exactly upstream's value for each capability,
//     with an absent capability still absent.
//  3. Send documentSymbol and references requests and assert each reaches
//     upstream verbatim while the editor receives no locally produced frame.
//
// @evidence contracts/testing.md#behavioral-verification Actual proxy dispatch over in-memory frames: the initialize response's documentSymbolProvider and referencesProvider values, the verbatim upstream bytes of both requests, and the absence of an editor frame within the authored 150 ms window.
// @evidence contracts/testing.md#independent-expectations Upstream ownership follows from the proxy owning neither method; expected capability values are the literal values the simulated upstream sent, and expected requests are the editor's own bytes.
// @evidence contracts/testing.md#distinguishing-cases The advertised and not-advertised initialize results differ only in the two capabilities. The not-advertised case is the one where a local fallback would add the capability and answer locally, so it distinguishes forwarding from fallback; the advertised case guards against dropping or rewriting an advertised value.
// @evidence contracts/testing.md#execution-ownership A unit test in ./test/driver drives the in-process Go proxy through the shared in-memory harness with NullPluginSource; no upstream process, compiler Program, installed consumer or editor runs.
func TestLSPProxyForwardsSymbolQueriesWhetherOrNotUpstreamAdvertises(t *testing.T) {
  cases := []struct {
    name         string
    capabilities map[string]any
  }{
    {
      name:         "upstream advertises both methods",
      capabilities: map[string]any{"documentSymbolProvider": true, "referencesProvider": true},
    },
    {
      name:         "upstream advertises neither method",
      capabilities: map[string]any{"hoverProvider": true},
    },
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      h := newProxyHarness(t, nil)

      h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
      _ = h.recvUpstream()
      result, err := json.Marshal(map[string]any{
        "jsonrpc": "2.0",
        "id":      1,
        "result":  map[string]any{"capabilities": testCase.capabilities},
      })
      if err != nil {
        t.Fatal(err)
      }
      h.sendUpstream(result)

      var initialized struct {
        Result struct {
          Capabilities map[string]any `json:"capabilities"`
        } `json:"result"`
      }
      if err := json.Unmarshal(h.recvEditor(), &initialized); err != nil {
        t.Fatalf("decode initialize response: %v", err)
      }
      for _, capability := range []string{"documentSymbolProvider", "referencesProvider"} {
        want, wantPresent := testCase.capabilities[capability]
        got, gotPresent := initialized.Result.Capabilities[capability]
        if gotPresent != wantPresent || got != want {
          t.Fatalf("%s = %v (present %v), want upstream's %v (present %v)", capability, got, gotPresent, want, wantPresent)
        }
      }

      for id, request := range []struct {
        method string
        params map[string]any
      }{
        {
          method: "textDocument/documentSymbol",
          params: map[string]any{"textDocument": map[string]any{"uri": "file:///workspace/main.ts"}},
        },
        {
          method: "textDocument/references",
          params: map[string]any{
            "textDocument": map[string]any{"uri": "file:///workspace/main.ts"},
            "position":     map[string]any{"line": 0, "character": 16},
            "context":      map[string]any{"includeDeclaration": true},
          },
        },
      } {
        body := symbolQueryBody(t, id+2, request.method, request.params)
        h.sendEditor(body)
        if got := h.recvUpstream(); string(got) != string(body) {
          t.Fatalf("%s was not forwarded verbatim:\ngot:  %s\nwant: %s", request.method, got, body)
        }
      }
      h.expectNoEditorFrame(150 * time.Millisecond)
    })
  }
}

// symbolQueryBody builds one JSON-RPC request frame body.
func symbolQueryBody(t *testing.T, id int, method string, params any) []byte {
  t.Helper()
  raw, err := json.Marshal(params)
  if err != nil {
    t.Fatal(err)
  }
  body, err := json.Marshal(driver.Envelope{
    JSONRPC: "2.0",
    ID:      json.RawMessage(strconv.Itoa(id)),
    Method:  method,
    Params:  raw,
  })
  if err != nil {
    t.Fatal(err)
  }
  return body
}
