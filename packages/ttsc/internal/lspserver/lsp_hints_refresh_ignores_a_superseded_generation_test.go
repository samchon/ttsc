package lspserver

import "testing"

// TestLSPHintsRefreshIgnoresASupersededGeneration pins the staleness guard.
//
// Refresh cycles are driven by editor events, and the answer the user is waiting
// for is the newest one. A cycle that started earlier can still finish later —
// its sidecar took longer, or a spawn was slow — and without a generation stamp
// its result would silently restore the corpus the newer cycle just replaced.
// The user would then see items for a rule they had already disabled, with no
// event left to correct it.
//
//  1. Store a corpus produced by a newer generation.
//  2. Store the older generation's result afterwards.
//  3. Assert the newer corpus stands, and that a still-newer one replaces it.
//
// @evidence contracts/testing.md#behavioral-verification A corpus stored by an older generation after a newer one does not replace it, and a still-newer one does.
// @evidence contracts/testing.md#independent-expectations The expected surviving corpus is a literal per store order.
// @evidence contracts/testing.md#distinguishing-cases The out-of-order store is the case a missing generation stamp would get wrong.
// @evidence contracts/testing.md#execution-ownership TestLSPHintsRefreshIgnoresASupersededGeneration is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
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
