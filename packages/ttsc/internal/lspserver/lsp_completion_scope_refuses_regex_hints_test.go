package lspserver

import (
  "encoding/json"
  "strings"
  "testing"
)

type regexScopeCompletionHintSource struct{ NullPluginSource }

func (regexScopeCompletionHintSource) CompletionHints() []LSPCompletionHint {
  return []LSPCompletionHint{{
    Scope: "jsdoc",
    After: "@tag",
    Items: []LSPCompletionItem{{Insert: "tag"}},
  }}
}

// TestLSPCompletionScopeRefusesRegexHints checks one regex cursor refusal and
// one real JSDoc cursor admission through the actual request helper.
//
// @evidence contracts/testing.md#behavioral-verification Actual Proxy.completionItemsFor returns zero items at the authored regex-class cursor and one item at the authored real-doc cursor. This unit asserts counts, not item content, replacement range, the refusal's internal reason or all regex contexts.
// @evidence contracts/testing.md#independent-expectations Zero items for the regex and one item for the block are literal expectations.
// @evidence contracts/testing.md#distinguishing-cases The two documents contain the same '@tag' text in different lexical contexts.
// @evidence contracts/testing.md#execution-ownership This Go unit uses an owned CompletionHints source and completionScopePending to replace the supplied document map and author request JSON before invoking the actual request helper. Cursor conversion/classification and matching run in-process; no directory, sidecar, compiler, process or LSP transport runs, and no response reaches an editor.
func TestLSPCompletionScopeRefusesRegexHints(t *testing.T) {
  const uri = "file:///project/src/main.ts"
  proxy := &Proxy{source: regexScopeCompletionHintSource{}}
  regex := "if /* c */ (ok) /[/** @tag]/.test(value)"
  real := "const value = 1;\n/** @tag"

  if pending := completionScopePending(proxy, uri, regex, 0, strings.Index(regex, "@tag")+4); len(pending.items) != 0 {
    t.Fatalf("regex completion items = %#v, want none", pending.items)
  }
  if pending := completionScopePending(proxy, uri, real, 1, len("/** @tag")); len(pending.items) != 1 {
    t.Fatalf("real JSDoc completion items = %#v, want one", pending.items)
  }
}

func completionScopePending(
  proxy *Proxy,
  uri string,
  text string,
  line int,
  character int,
) pendingCompletionRequest {
  proxy.documentText = map[string]string{uri: text}
  params, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
    "position": map[string]any{
      "line":      line,
      "character": character,
    },
  })
  return proxy.completionItemsFor(Envelope{Params: params})
}
