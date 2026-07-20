package lspserver

import (
  "bytes"
  "testing"
)

// TestLSPHintsRefreshKeepsEachProducerIsolated pins the failure boundary between
// producers.
//
// A refresh re-asks every plugin, and plugins fail independently: one sidecar
// can be mid-rebuild, locked by a virus scanner, or simply gone while the others
// answer normally. A refresh that rebuilt one shared slice would let that single
// failure blank a working producer's corpus — the editor would lose completions
// it had a second ago for a reason unrelated to the rule that published them.
// The rule is that only a producer's own successful answer changes its corpus.
//
//  1. Give two producers a good corpus.
//  2. Run a whole refresh generation in which neither sidecar can be executed.
//  3. Assert both corpora survived, in manifest order, with nothing logged.
//  4. Let only the first producer answer, and assert the second is untouched.
func TestLSPHintsRefreshKeepsEachProducerIsolated(t *testing.T) {
  var log bytes.Buffer
  first := NativeLSPPluginEntry{Binary: "ttsc-no-such-plugin-binary-a", Name: "@ttsc/lint"}
  second := NativeLSPPluginEntry{Binary: "ttsc-no-such-plugin-binary-b", Name: "@samchon/evidence"}
  source := &NativePluginSource{
    err:     &log,
    plugins: []NativeLSPPluginEntry{first, second},
  }
  source.storeCompletionHints(first, 1, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "param"}}},
  })
  source.storeCompletionHints(second, 1, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@evidence ", Items: []LSPCompletionItem{{Insert: "docs/rfc.md"}}},
  })

  source.discoverCompletionHints(2)

  hints := source.CompletionHints()
  if len(hints) != 2 || hints[0].After != "@" || hints[1].After != "@evidence " {
    t.Fatalf("a refresh that could reach no producer disturbed the corpus: %#v", hints)
  }
  if log.Len() != 0 {
    t.Errorf(
      "a producer that could not answer was logged as a failure:\n%s\n"+
        "refresh runs per save, so that line would print on every save",
      log.String(),
    )
  }

  source.storeCompletionHints(first, 3, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "param"}, {Insert: "returns"}}},
  })
  hints = source.CompletionHints()
  if len(hints) != 2 {
    t.Fatalf("one producer's refresh changed the number of published hints: %#v", hints)
  }
  if len(hints[0].Items) != 2 {
    t.Errorf("the refreshed producer still serves its old corpus: %#v", hints[0])
  }
  if hints[1].After != "@evidence " || len(hints[1].Items) != 1 {
    t.Errorf("an unrelated producer's corpus was disturbed: %#v", hints[1])
  }
}
