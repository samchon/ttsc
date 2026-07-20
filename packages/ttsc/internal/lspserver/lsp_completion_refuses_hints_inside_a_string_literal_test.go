package lspserver

import (
  "encoding/json"
  "testing"
)

type jsdocTagCompletionHintSource struct{ NullPluginSource }

func (jsdocTagCompletionHintSource) CompletionHints() []LSPCompletionHint {
  return []LSPCompletionHint{{
    Scope: "jsdoc",
    After: "@",
    Items: []LSPCompletionItem{{Insert: "param"}},
  }}
}

// TestLSPCompletionRefusesHintsInsideAStringLiteral verifies the scope decision
// where it is observable.
//
// The lexical table proves the scanner; this proves the request path still asks
// it. A refactor that recomputed scope from the line prefix, or that passed the
// wrong offset, would put `jsdoc/check-tag-names` tags into ordinary source
// text — a position the owning rule never inspects — and no unit test of the
// matcher alone would notice.
//
//  1. Ask for completion after `@par` inside a string literal that contains the
//     JSDoc opener.
//  2. Ask again at the same tag inside a real doc comment.
//  3. Assert silence for the first and the published item for the second.
func TestLSPCompletionRefusesHintsInsideAStringLiteral(t *testing.T) {
  const literalURI = "file:///project/src/literal.ts"
  const blockURI = "file:///project/src/block.ts"
  proxy := &Proxy{
    source: jsdocTagCompletionHintSource{},
    documentText: map[string]string{
      literalURI: "const example = \"/** @par\";\n",
      blockURI:   "/**\n * @par\n */\nexport const value = 1;\n",
    },
  }

  literalParams, err := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": literalURI},
    "position":     map[string]any{"line": 0, "character": 25},
  })
  if err != nil {
    t.Fatalf("encode completion params: %v", err)
  }
  if pending := proxy.completionItemsFor(Envelope{Params: literalParams}); len(pending.items) != 0 {
    t.Errorf("a string literal was offered %v, want nothing", inserts(pending.items))
  }

  blockParams, err := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": blockURI},
    "position":     map[string]any{"line": 1, "character": 7},
  })
  if err != nil {
    t.Fatalf("encode completion params: %v", err)
  }
  pending := proxy.completionItemsFor(Envelope{Params: blockParams})
  if got := inserts(pending.items); !equalStrings(got, []string{"param"}) {
    t.Fatalf("a real doc comment was offered %v, want [param]", got)
  }
  // The refusal must not have come from a broken filter range either.
  if pending.replaceRange.Start != (LSPPosition{Line: 1, Character: 4}) ||
    pending.replaceRange.End != (LSPPosition{Line: 1, Character: 7}) {
    t.Errorf("replacement range = %+v, want character 4..7", pending.replaceRange)
  }
}
