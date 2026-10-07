package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// completionHintPluginSource is an embedder-defined PluginSource that publishes
// one JSDoc completion hint through the optional public CompletionHintSource
// capability. It embeds NullPluginSource, so everything else stays silent.
type completionHintPluginSource struct {
  driver.PluginSource
}

func (*completionHintPluginSource) CompletionHints() []driver.LSPCompletionHint {
  return []driver.LSPCompletionHint{{
    Scope: "jsdoc",
    After: "@evidence ",
    Items: []driver.LSPCompletionItem{{
      Insert: "docs/spec.md",
      Label:  "spec",
      Detail: "Evidence specification",
    }},
  }}
}

// TestLSPProxyAppendsEmbedderCompletionHintsToUpstreamResponse Verifies that the proxy appends a JSDoc hint while retaining the upstream item, response ID, hint fields, and zero-width cursor range.
//
// The positive JSDoc scope complements the line-comment negative in the sibling entry.
//
// 1. Build a proxy over an embedder source whose only contribution is one JSDoc hint triggered after "@evidence ".
// 2. Open a document whose cursor sits right after "@evidence " in a JSDoc comment and send textDocument/completion; assert it is forwarded upstream.
// 3. Answer from upstream with one compiler item and assert the editor receives both items, the hint item carrying its label, insert text, detail and a zero-width replace range at the cursor, while the upstream item survives.
//
// @evidence contracts/testing.md#behavioral-verification The proxy appends a JSDoc hint while retaining the upstream item, response ID, hint fields, and zero-width cursor range.
// @evidence contracts/testing.md#independent-expectations The embedder's literal hint, authored compiler item, and cursor position independently specify the result.
// @evidence contracts/testing.md#distinguishing-cases The positive JSDoc scope complements the line-comment negative in the sibling entry.
// @evidence contracts/testing.md#execution-ownership newProxyHarness runs the owning Go proxy over io.Pipe with an embedder source, without tsgo. Go discovers TestLSPProxyAppendsEmbedderCompletionHintsToUpstreamResponse under ./test/driver.
func TestLSPProxyAppendsEmbedderCompletionHintsToUpstreamResponse(t *testing.T) {
  h := newProxyHarness(t, &completionHintPluginSource{PluginSource: driver.NullPluginSource{}})

  const uri = "file:///a.ts"
  text := "/**\n * @evidence \n */\nexport {};\n"
  open, err := json.Marshal(map[string]any{
    "jsonrpc": "2.0",
    "method":  "textDocument/didOpen",
    "params": map[string]any{
      "textDocument": map[string]any{"uri": uri, "version": 1, "languageId": "typescript", "text": text},
    },
  })
  if err != nil {
    t.Fatal(err)
  }
  h.sendEditor(open)
  _ = h.recvUpstream()

  // " * @evidence " is 13 UTF-16 units, so the cursor sits right after the trigger.
  request := []byte(`{"jsonrpc":"2.0","id":5,"method":"textDocument/completion","params":{"textDocument":{"uri":"file:///a.ts"},"position":{"line":1,"character":13}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); string(got) != string(request) {
    t.Fatalf("completion request was not forwarded upstream verbatim:\n%s", got)
  }

  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":5,"result":[{"label":"tsgo-item"}]}`))
  body := h.recvEditor()
  var decoded struct {
    ID     int `json:"id"`
    Result struct {
      Items []struct {
        Label      string `json:"label"`
        InsertText string `json:"insertText"`
        Detail     string `json:"detail"`
        TextEdit   *struct {
          Range struct {
            Start struct{ Line, Character int } `json:"start"`
            End   struct{ Line, Character int } `json:"end"`
          } `json:"range"`
          NewText string `json:"newText"`
        } `json:"textEdit"`
      } `json:"items"`
    } `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("completion response is not a CompletionList: %v\n%s", err, body)
  }
  if decoded.ID != 5 || len(decoded.Result.Items) != 2 {
    t.Fatalf("want id 5 with the upstream item and the hint item, got:\n%s", body)
  }
  if decoded.Result.Items[0].Label != "tsgo-item" {
    t.Fatalf("upstream item lost or reordered:\n%s", body)
  }
  hint := decoded.Result.Items[1]
  if hint.Label != "spec" || hint.InsertText != "docs/spec.md" || hint.Detail != "Evidence specification" {
    t.Fatalf("hint item does not carry the published label/insert/detail:\n%s", body)
  }
  if hint.TextEdit == nil || hint.TextEdit.NewText != "docs/spec.md" ||
    hint.TextEdit.Range.Start.Line != 1 || hint.TextEdit.Range.Start.Character != 13 ||
    hint.TextEdit.Range.End.Line != 1 || hint.TextEdit.Range.End.Character != 13 {
    t.Fatalf("hint item must replace the empty filter at line 1, character 13:\n%s", body)
  }
}

// TestLSPProxyLeavesCompletionAloneOutsideJSDoc Verifies that a line-comment trigger leaves the upstream completion response unchanged.
//
// The same hint and trigger as the positive sibling isolate comment scope.
//
// 1. Open a document with the hint trigger in a line comment and request completion.
// 2. Answer upstream with one compiler item and assert the editor receives the original bytes.
//
// @evidence contracts/testing.md#behavioral-verification A line-comment trigger leaves the upstream completion response unchanged.
// @evidence contracts/testing.md#independent-expectations The authored original response is expected because the trigger is outside JSDoc scope.
// @evidence contracts/testing.md#distinguishing-cases The same hint and trigger as the positive sibling isolate comment scope.
// @evidence contracts/testing.md#execution-ownership An embedder source and Go pipe proxy execute one completion exchange without a server process. Go discovers TestLSPProxyLeavesCompletionAloneOutsideJSDoc under ./test/driver.
func TestLSPProxyLeavesCompletionAloneOutsideJSDoc(t *testing.T) {
  h := newProxyHarness(t, &completionHintPluginSource{PluginSource: driver.NullPluginSource{}})

  open, err := json.Marshal(map[string]any{
    "jsonrpc": "2.0",
    "method":  "textDocument/didOpen",
    "params": map[string]any{
      "textDocument": map[string]any{"uri": "file:///a.ts", "version": 1, "languageId": "typescript", "text": "// @evidence \nexport {};\n"},
    },
  })
  if err != nil {
    t.Fatal(err)
  }
  h.sendEditor(open)
  _ = h.recvUpstream()

  request := []byte(`{"jsonrpc":"2.0","id":6,"method":"textDocument/completion","params":{"textDocument":{"uri":"file:///a.ts"},"position":{"line":0,"character":13}}}`)
  h.sendEditor(request)
  _ = h.recvUpstream()

  response := []byte(`{"jsonrpc":"2.0","id":6,"result":[{"label":"tsgo-item"}]}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); string(got) != string(response) {
    t.Fatalf("a line comment is not a JSDoc scope; upstream answer must be untouched:\n%s", got)
  }
}
