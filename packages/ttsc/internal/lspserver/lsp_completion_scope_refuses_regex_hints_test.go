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

// TestLSPCompletionScopeRefusesRegexHints verifies the request path never
// offers JSDoc hints inside a regex while still offering one in a real JSDoc
// block immediately after executable code.
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
      "line": line,
      "character": character,
    },
  })
  return proxy.completionItemsFor(Envelope{Params: params})
}
