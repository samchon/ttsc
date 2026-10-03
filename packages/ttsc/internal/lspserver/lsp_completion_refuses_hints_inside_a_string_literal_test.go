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
// The actual request helper classifies two supplied documents: a string
// containing a JSDoc opener and a real doc comment. A prefix-only classifier
// would incorrectly admit the first. These observations do not run the owning
// lint rule, publish an LSP response or certify every scanner boundary.
//
//  1. Ask for completion after `@par` inside a string literal that contains the
//     JSDoc opener.
//  2. Ask again at the same tag inside a real doc comment.
//  3. Assert silence for the first and the supplied item/range for the second.
//
// @evidence contracts/testing.md#behavioral-verification Actual Proxy.completionItemsFor returns no items at the supplied string-literal cursor, then returns the supplied param item and literal line-1 range 4..7 for the real doc-comment cursor. The negative branch asserts item absence, not the reason for refusal or its range.
// @evidence contracts/testing.md#independent-expectations Empty items, the supplied param insertion and the real comment's literal range columns are authored expectations, not computed from the scanner or matcher.
// @evidence contracts/testing.md#distinguishing-cases Both cursors follow @par with the same supplied hint source; the containing documents, URI and cursor positions differ. The positive comment prevents unconditional empty results from satisfying the pair; the quoted opener distinguishes a prefix-only classifier.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes the actual request helper on an owned CompletionHints source, a supplied document map and authored JSON params. Actual position conversion, lexical classification, matching and range construction run in-process; no directory, sidecar, compiler, lint rule, process or LSP transport runs.
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
  // The admitted comment also has the literal replacement range.
  if pending.replaceRange.Start != (LSPPosition{Line: 1, Character: 4}) ||
    pending.replaceRange.End != (LSPPosition{Line: 1, Character: 7}) {
    t.Errorf("replacement range = %+v, want character 4..7", pending.replaceRange)
  }
}
