package lspserver

import (
  "encoding/json"
  "testing"
)

type nearestCompletionHintSource struct{ NullPluginSource }

func (nearestCompletionHintSource) CompletionHints() []LSPCompletionHint {
  return []LSPCompletionHint{
    {Scope: "jsdoc", After: "@evidence", Items: []LSPCompletionItem{{Insert: "long"}}},
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "near"}}},
  }
}

// TestLSPCompletionNearestHintReplacesNearestFilter exercises the request path:
// a later short trigger beats an earlier long trigger and replaces only the
// filter immediately after the winning occurrence.
//
// @evidence contracts/testing.md#behavioral-verification completionItemsFor returns only the nearest trigger's item and a replacement range that covers just the filter after that trigger.
// @evidence contracts/testing.md#independent-expectations The expected item and range columns are literals computed from the literal document text.
// @evidence contracts/testing.md#distinguishing-cases An earlier long trigger and a later short one share the line, so the earlier one's filter would give a different range.
// @evidence contracts/testing.md#execution-ownership TestLSPCompletionNearestHintReplacesNearestFilter is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestLSPCompletionNearestHintReplacesNearestFilter(t *testing.T) {
  const uri = "file:///project/src/main.ts"
  const text = "/** @evidence first @pa"
  proxy := &Proxy{
    source:       nearestCompletionHintSource{},
    documentText: map[string]string{uri: text},
  }
  params, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
    "position":     map[string]any{"line": 0, "character": 23},
  })

  pending := proxy.completionItemsFor(Envelope{Params: params})
  if len(pending.items) != 1 || pending.items[0].Insert != "near" {
    t.Fatalf("items = %#v, want only the nearest trigger item", pending.items)
  }
  if !pending.hasRange {
    t.Fatal("nearest trigger did not produce a replacement range")
  }
  if pending.replaceRange.Start != (LSPPosition{Line: 0, Character: 21}) ||
    pending.replaceRange.End != (LSPPosition{Line: 0, Character: 23}) {
    t.Errorf("replacement range = %+v, want character 21..23", pending.replaceRange)
  }
}
