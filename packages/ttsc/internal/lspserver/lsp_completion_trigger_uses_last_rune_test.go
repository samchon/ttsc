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

// TestLSPCompletionTriggerUsesLastRune checks two supplied trigger endings.
//
// @evidence contracts/testing.md#behavioral-verification Actual pluginCompletionTriggerCharacters returns the ordered literal pair @ and fullwidth slash from the two supplied After strings. The result does not establish client trigger registration, duplicate/empty-trigger handling or malformed UTF-8 behavior.
// @evidence contracts/testing.md#independent-expectations The expected list is the literal pair '@' and the fullwidth slash.
// @evidence contracts/testing.md#distinguishing-cases A multi-byte final rune distinguishes last-rune from last-byte extraction.
// @evidence contracts/testing.md#execution-ownership This Go unit supplies an owned CompletionHints source on a Proxy and directly invokes its actual trigger projection. It substitutes no projection operation and creates no directory or sidecar; no compiler, process, product host, initialization message or editor runs. Items are intentionally absent because this projection reads After rather than request admission.
func TestLSPCompletionTriggerUsesLastRune(t *testing.T) {
  proxy := &Proxy{source: unicodeCompletionTriggerSource{}}
  got := proxy.pluginCompletionTriggerCharacters()
  want := []string{"@", "／"}
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("trigger characters = %#v, want %#v", got, want)
  }
}
