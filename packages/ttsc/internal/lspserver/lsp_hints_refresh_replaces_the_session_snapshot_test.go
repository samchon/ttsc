package lspserver

import (
  "reflect"
  "testing"
)

// TestLSPHintsRefreshReplacesTheSessionSnapshot pins the lifecycle the corpus
// channel shipped without.
//
// The first release fetched the corpus once, in a goroutine started by
// NewNativePluginSource, and every later read was that same slice. A rule
// enabled after startup, or a contributor index rebuilt from a saved document,
// could not reach the editor without restarting the language server — which is
// precisely when a project-derived corpus is most wrong. Each stage below is a
// state the proxy must serve correctly, including the two that are easy to get
// backwards: a corpus that shrinks must shrink, and one that never arrived must
// stay silent rather than fail open.
//
//  1. Read the corpus before any producer has answered.
//  2. Let a producer answer, and read again through the proxy's completion seam.
//  3. Let the same producer answer differently, then answer with nothing.
func TestLSPHintsRefreshReplacesTheSessionSnapshot(t *testing.T) {
  plugin := NativeLSPPluginEntry{Binary: "ttsc-lint", Name: "@ttsc/lint"}
  source := &NativePluginSource{plugins: []NativeLSPPluginEntry{plugin}}
  proxy := &Proxy{source: source}

  if hints := proxy.pluginCompletionHints(); len(hints) != 0 {
    t.Fatalf("a source whose producers have not answered published %d hints", len(hints))
  }
  if triggers := proxy.pluginCompletionTriggerCharacters(); len(triggers) != 0 {
    t.Fatalf("an empty corpus advertised trigger characters %v", triggers)
  }

  source.storeCompletionHints(plugin, 1, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "param"}}},
  })
  hints := proxy.pluginCompletionHints()
  if len(hints) != 1 || hints[0].After != "@" || len(hints[0].Items) != 1 {
    t.Fatalf("a corpus that arrived after startup did not reach the proxy: %#v", hints)
  }
  if got := proxy.pluginCompletionTriggerCharacters(); !reflect.DeepEqual(got, []string{"@"}) {
    t.Fatalf("trigger characters = %#v, want [\"@\"]", got)
  }

  // The same producer, re-asked, is the whole point: its answer replaces the
  // previous one rather than accumulating beside it.
  source.storeCompletionHints(plugin, 2, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@evidence ", Items: []LSPCompletionItem{{Insert: "docs/rfc.md"}}},
  })
  hints = proxy.pluginCompletionHints()
  if len(hints) != 1 || hints[0].After != "@evidence " {
    t.Fatalf("a changed corpus did not replace the previous one: %#v", hints)
  }
  if got := proxy.pluginCompletionTriggerCharacters(); !reflect.DeepEqual(got, []string{" "}) {
    t.Fatalf("trigger characters = %#v, want [\" \"] from the new corpus", got)
  }

  // A rule turned off publishes nothing. Treating an empty successful answer as
  // "keep what you had" would leave a disabled rule's items in the popup for the
  // rest of the session.
  source.storeCompletionHints(plugin, 3, nil)
  if hints := proxy.pluginCompletionHints(); len(hints) != 0 {
    t.Fatalf("a producer that stopped publishing left %d hints behind", len(hints))
  }
}
