package lspserver

import (
  "encoding/json"
  "testing"
)

type rankedCompletionHintSource struct{ NullPluginSource }

func (rankedCompletionHintSource) CompletionHints() []LSPCompletionHint {
  return []LSPCompletionHint{{
    Scope: "jsdoc",
    After: "@evidence ",
    Items: []LSPCompletionItem{
      {Insert: "docs/stable.md", Label: "stable"},
      {Insert: "docs/derived.md"},
    },
  }}
}

// TestLSPCompletionReplacesFullFilterInRankOrder verifies path completion edits.
//
// A completion label containing slashes cannot rely on the editor's default
// word range: replacing only the last segment of `文档/sp` would duplicate the
// path prefix. The range is measured in UTF-16 units, and explicit sort keys
// preserve the publisher's ranking instead of letting the client alphabetize it.
//
//  1. Match two ranked hints after a non-BMP character and a CJK path prefix.
//  2. Merge them into the null completion response tsgo uses in JSDoc prose.
//  3. Assert both text edits replace the full filter and sort in slice order.
func TestLSPCompletionReplacesFullFilterInRankOrder(t *testing.T) {
  const uri = "file:///project/src/main.ts"
  const text = "/** 😀 @evidence 文档/sp"
  proxy := &Proxy{
    source:       rankedCompletionHintSource{},
    documentText: map[string]string{uri: text},
  }
  params, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
    "position":     map[string]any{"line": 0, "character": 22},
  })
  pending := proxy.completionItemsFor(Envelope{Params: params})
  if len(pending.items) != 2 {
    t.Fatalf("matched %d completion items, want 2", len(pending.items))
  }

  merged := mergeCompletionResponseWithRequest(
    []byte(`{"jsonrpc":"2.0","id":1,"result":null}`),
    pending,
  )
  var response struct {
    Result struct {
      Items []struct {
        FilterText string `json:"filterText"`
        SortText   string `json:"sortText"`
        TextEdit   struct {
          Range   LSPRange `json:"range"`
          NewText string   `json:"newText"`
        } `json:"textEdit"`
      } `json:"items"`
    } `json:"result"`
  }
  if err := json.Unmarshal(merged, &response); err != nil {
    t.Fatalf("decode merged completion response: %v\n%s", err, merged)
  }
  if len(response.Result.Items) != 2 {
    t.Fatalf("merged %d completion items, want 2", len(response.Result.Items))
  }
  for index, item := range response.Result.Items {
    if item.TextEdit.Range.Start != (LSPPosition{Line: 0, Character: 17}) ||
      item.TextEdit.Range.End != (LSPPosition{Line: 0, Character: 22}) {
      t.Errorf("item %d replacement range = %+v, want character 17..22", index, item.TextEdit.Range)
    }
    if item.FilterText != item.TextEdit.NewText {
      t.Errorf("item %d filterText = %q, want inserted text %q", index, item.FilterText, item.TextEdit.NewText)
    }
  }
  if response.Result.Items[0].SortText >= response.Result.Items[1].SortText {
    t.Errorf(
      "sort keys %q, %q do not preserve publisher order",
      response.Result.Items[0].SortText,
      response.Result.Items[1].SortText,
    )
  }
}
