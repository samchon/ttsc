package lspserver

import "testing"

// TestLSPHintsRefreshIgnoresASupersededGeneration pins the staleness guard.
//
// The unit supplies generation 2, then 1, then 3 directly to the cache writer.
// It observes selected insertion text through the snapshot accessor, not actual
// refresh concurrency, sidecar completion order or editor presentation.
//
//  1. Store a corpus produced by a newer generation.
//  2. Store the older generation's result afterwards.
//  3. Assert the newer corpus stands, and that a still-newer one replaces it.
//
// @evidence contracts/testing.md#behavioral-verification Actual storeCompletionHints receives generation 2 with returns, then generation 1 with stale; CompletionHints has one hint/one item with returns. Generation 3 with param then yields one hint with param as its first insertion. Other hint fields, equal-generation behavior and actual refresh scheduling are not asserted.
// @evidence contracts/testing.md#independent-expectations The expected surviving corpus is a literal per store order.
// @evidence contracts/testing.md#distinguishing-cases The out-of-order store is the case a missing generation stamp would get wrong.
// @evidence contracts/testing.md#execution-ownership This Go unit directly invokes actual NativePluginSource cache storage and snapshot methods on an owned plugin entry and literal hints. Binary/name are opaque cache metadata here; no command discovery, filesystem fixture, sidecar, compiler, process, product host or LSP transport runs, and no operation is substituted.
func TestLSPHintsRefreshIgnoresASupersededGeneration(t *testing.T) {
  plugin := NativeLSPPluginEntry{Binary: "ttsc-lint", Name: "@ttsc/lint"}
  source := &NativePluginSource{plugins: []NativeLSPPluginEntry{plugin}}

  source.storeCompletionHints(plugin, 2, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "returns"}}},
  })
  source.storeCompletionHints(plugin, 1, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "stale"}}},
  })

  hints := source.CompletionHints()
  if len(hints) != 1 || len(hints[0].Items) != 1 || hints[0].Items[0].Insert != "returns" {
    t.Fatalf("an older refresh generation overwrote a newer corpus: %#v", hints)
  }

  source.storeCompletionHints(plugin, 3, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "param"}}},
  })
  hints = source.CompletionHints()
  if len(hints) != 1 || hints[0].Items[0].Insert != "param" {
    t.Fatalf("the guard rejected a newer generation as well: %#v", hints)
  }
}
