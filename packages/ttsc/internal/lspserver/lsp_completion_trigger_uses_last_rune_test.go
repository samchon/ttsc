package lspserver

import (
  "reflect"
  "testing"
)

type unicodeCompletionTriggerSource struct{ NullPluginSource }

func (unicodeCompletionTriggerSource) CompletionHints() []LSPCompletionHint {
  return []LSPCompletionHint{
    {Scope: "jsdoc", After: "@"},
    {Scope: "jsdoc", After: "문서／"},
  }
}

func TestLSPCompletionTriggerUsesLastRune(t *testing.T) {
  proxy := &Proxy{source: unicodeCompletionTriggerSource{}}
  got := proxy.pluginCompletionTriggerCharacters()
  want := []string{"@", "／"}
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("trigger characters = %#v, want %#v", got, want)
  }
}
