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
// @evidence contracts/testing.md#behavioral-verification Actual storeCompletionHints accepts generation 2 with returns, rejects generation 1 with stale, and preserves returns. Generation 3 with param is accepted and exposed, then an equal-generation successful empty store is accepted and clears the corpus. The bool result distinguishes accepted empty publication from a rejected stale result; actual refresh scheduling is not asserted.
// @evidence contracts/testing.md#independent-expectations The expected surviving corpus is a literal per store order.
// @evidence contracts/testing.md#distinguishing-cases Covers newer and equal-generation acceptance, stale rejection with retained contents, and successful-empty clearing. The acceptance result prevents observation from claiming a stale result was published.
// @evidence contracts/testing.md#execution-ownership This Go unit directly invokes actual NativePluginSource cache storage and snapshot methods on an owned plugin entry and literal hints. Binary/name are opaque cache metadata here; no command discovery, filesystem fixture, sidecar, compiler, process, product host or LSP transport runs, and no operation is substituted.
func TestLSPHintsRefreshIgnoresASupersededGeneration(t *testing.T) {
  plugin := NativeLSPPluginEntry{Binary: "ttsc-lint", Name: "@ttsc/lint"}
  source := &NativePluginSource{plugins: []NativeLSPPluginEntry{plugin}}

  if !source.storeCompletionHints(plugin, 2, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "returns"}}},
  }) { t.Error("newer corpus was not accepted") }
  if source.storeCompletionHints(plugin, 1, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "stale"}}},
  }) { t.Error("stale corpus claimed publication") }

  hints := source.CompletionHints()
  if len(hints) != 1 || len(hints[0].Items) != 1 || hints[0].Items[0].Insert != "returns" {
    t.Fatalf("an older refresh generation overwrote a newer corpus: %#v", hints)
  }

  if !source.storeCompletionHints(plugin, 3, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "param"}}},
  }) { t.Error("new generation was not accepted") }
  hints = source.CompletionHints()
  if len(hints) != 1 || hints[0].Items[0].Insert != "param" {
    t.Fatalf("the guard rejected a newer generation as well: %#v", hints)
  }
  if !source.storeCompletionHints(plugin, 3, nil) {
    t.Error("successful equal-generation empty corpus was not accepted")
  }
  if hints := source.CompletionHints(); len(hints) != 0 {
    t.Errorf("successful-empty publication retained hints: %#v", hints)
  }
}
