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

//
// @evidence contracts/testing.md#behavioral-verification pluginCompletionTriggerCharacters reports the last rune of each trigger, including a multi-byte one.
// @evidence contracts/testing.md#independent-expectations The expected list is the literal pair '@' and the fullwidth slash.
// @evidence contracts/testing.md#distinguishing-cases A multi-byte final rune distinguishes last-rune from last-byte extraction.
// @evidence contracts/testing.md#execution-ownership TestLSPCompletionTriggerUsesLastRune is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestLSPCompletionTriggerUsesLastRune(t *testing.T) {
  proxy := &Proxy{source: unicodeCompletionTriggerSource{}}
  got := proxy.pluginCompletionTriggerCharacters()
  want := []string{"@", "／"}
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("trigger characters = %#v, want %#v", got, want)
  }
}
