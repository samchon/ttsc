package lspserver

import (
  "reflect"
  "testing"
)

// TestLSPHintsRefreshReplacesTheSessionSnapshot pins the corpus lifecycle.
//
// Direct cache stores transition from no hints to one hint, replace that hint
// with another one, then clear it. Actual proxy accessors expose those values
// and selected trigger characters. No startup, producer reply, rule toggle,
// contributor rebuild, editor popup or language-server restart executes here.
//
//  1. Read the empty corpus before a direct cache store.
//  2. Store one literal hint and read it through the actual proxy accessor.
//  3. Replace it with another literal hint, then store nil to clear it.
//
// @evidence contracts/testing.md#behavioral-verification Actual storeCompletionHints and proxy accessors expose literal transitions empty→param hint→docs/rfc.md hint→empty. Trigger characters are independently asserted before storage and after the two nonempty stores; the cleared state's trigger projection is not separately asserted.
// @evidence contracts/testing.md#independent-expectations The expected corpus at each stage is a literal.
// @evidence contracts/testing.md#distinguishing-cases Empty, singleton insertion, singleton replacement and explicit nil clearing reject stale accumulation or retention; replacement changes content and trigger rather than reducing hint count.
// @evidence contracts/testing.md#execution-ownership This Go unit directly invokes actual NativePluginSource cache storage and Proxy hint/trigger accessors. The supplied binary/name are opaque cache metadata, not executable selection; no directory, sidecar, compiler, process, product host, LSP transport or substituted operation runs.
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
  if !reflect.DeepEqual(hints, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "param"}}},
  }) {
    t.Errorf("first snapshot = %#v, want the literal param hint", hints)
  }
  if got := proxy.pluginCompletionTriggerCharacters(); !reflect.DeepEqual(got, []string{"@"}) {
    t.Fatalf("trigger characters = %#v, want [\"@\"]", got)
  }

  // The next direct store replaces the first hint rather than accumulating it.
  source.storeCompletionHints(plugin, 2, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@evidence ", Items: []LSPCompletionItem{{Insert: "docs/rfc.md"}}},
  })
  hints = proxy.pluginCompletionHints()
  if len(hints) != 1 || hints[0].After != "@evidence " {
    t.Fatalf("a changed corpus did not replace the previous one: %#v", hints)
  }
  if !reflect.DeepEqual(hints, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@evidence ", Items: []LSPCompletionItem{{Insert: "docs/rfc.md"}}},
  }) {
    t.Errorf("replacement snapshot = %#v, want the literal reference hint", hints)
  }
  if got := proxy.pluginCompletionTriggerCharacters(); !reflect.DeepEqual(got, []string{" "}) {
    t.Fatalf("trigger characters = %#v, want [\" \"] from the new corpus", got)
  }

  // Explicit nil storage clears this producer's prior hint.
  source.storeCompletionHints(plugin, 3, nil)
  if hints := proxy.pluginCompletionHints(); len(hints) != 0 {
    t.Fatalf("a producer that stopped publishing left %d hints behind", len(hints))
  }
}
