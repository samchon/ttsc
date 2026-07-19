package lspserver

import (
  "bytes"
  "encoding/json"
  "testing"
)

// TestLSPPluginCompletionResolveStaysLocal verifies completion ownership.
//
// TypeScript-Go advertises resolve support but dereferences its private data
// payload for every resolved item. A plugin hint has no such payload and is
// already complete, so forwarding it upstream can fault the language server.
//
//  1. Encode a plugin completion and send that item back as a resolve request.
//  2. Assert the proxy answers locally with the item unchanged.
//  3. Assert an upstream-owned item remains unhandled and is still forwarded.
func TestLSPPluginCompletionResolveStaysLocal(t *testing.T) {
  merged := mergeCompletionResponse(
    []byte(`{"jsonrpc":"2.0","id":1,"result":null}`),
    []LSPCompletionItem{{Insert: "evidence"}},
  )
  var completion struct {
    Result struct {
      Items []json.RawMessage `json:"items"`
    } `json:"result"`
  }
  if err := json.Unmarshal(merged, &completion); err != nil || len(completion.Result.Items) != 1 {
    t.Fatalf("decode plugin completion item: %v\n%s", err, merged)
  }
  item := completion.Result.Items[0]

  var editor bytes.Buffer
  proxy := &Proxy{editorOut: &editor}
  handled, err := proxy.handleEditorEnvelope(Envelope{
    JSONRPC: "2.0",
    ID:      json.RawMessage("7"),
    Method:  methodCompletionResolve,
    Params:  item,
  }, nil)
  if err != nil {
    t.Fatalf("resolve plugin completion: %v", err)
  }
  if !handled {
    t.Fatal("plugin completion resolve was forwarded upstream")
  }
  _, body, err := NewFrameReader(bytes.NewReader(editor.Bytes())).Read()
  if err != nil {
    t.Fatalf("read local resolve response: %v", err)
  }
  response, err := ParseEnvelope(body)
  if err != nil {
    t.Fatalf("parse local resolve response: %v", err)
  }
  var got any
  var want any
  if err := json.Unmarshal(response.Result, &got); err != nil {
    t.Fatalf("decode local resolve result: %v", err)
  }
  if err := json.Unmarshal(item, &want); err != nil {
    t.Fatalf("decode original plugin item: %v", err)
  }
  gotJSON, _ := json.Marshal(got)
  wantJSON, _ := json.Marshal(want)
  if !bytes.Equal(gotJSON, wantJSON) {
    t.Errorf("local resolve changed the plugin item:\n got %s\nwant %s", gotJSON, wantJSON)
  }

  editor.Reset()
  handled, err = proxy.handleEditorEnvelope(Envelope{
    JSONRPC: "2.0",
    ID:      json.RawMessage("8"),
    Method:  methodCompletionResolve,
    Params:  json.RawMessage(`{"label":"upstream","data":{"fileName":"/project/main.ts"}}`),
  }, nil)
  if err != nil {
    t.Fatalf("route upstream completion resolve: %v", err)
  }
  if handled || editor.Len() != 0 {
    t.Error("upstream completion resolve was intercepted instead of forwarded")
  }
}
