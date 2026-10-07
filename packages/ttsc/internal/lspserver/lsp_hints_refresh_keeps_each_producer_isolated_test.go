package lspserver

import (
  "bytes"
  "os/exec"
  "reflect"
  "testing"
)

// TestLSPHintsRefreshKeepsEachProducerIsolated pins the failure boundary between
// producers.
//
// Two unresolved producer binaries exercise failed discovery after their caches
// are seeded. A later direct store replaces only the first producer's cache.
// No producer successfully executes or returns a wire answer in this unit;
// antivirus/rebuild causes and actual editor presentation are unobserved.
//
//  1. Give two producers a good corpus.
//  2. Run a whole refresh generation in which neither sidecar can be executed.
//  3. Assert both corpora survived, in manifest order, with nothing logged.
//  4. Directly store the first producer's replacement and assert both literal lists.
//
// @evidence contracts/testing.md#behavioral-verification Actual failed discoverCompletionHints preserves the two literal seeded hints in manifest order and writes no log bytes. A direct generation-3 store replaces the first producer's item list while retaining the second producer's literal hint. No successful wire answer or mixed successful/failed discovery is exercised.
// @evidence contracts/testing.md#independent-expectations The expected corpora are literal hint lists per producer.
// @evidence contracts/testing.md#distinguishing-cases All-failed discovery and a later one-producer direct store distinguish retained caches from shared-slice replacement. Full literal list comparisons also reject mutations of item contents that trigger/count checks alone would miss.
// @evidence contracts/testing.md#execution-ownership This Go unit uses actual NativePluginSource store/discovery/snapshot methods and an owned logger. LookPath must reject both original binary names before native resident/direct execution attempts; no sidecar is installed or successfully started. No temporary directory or substituted query operation exists, and runtime selection/execution is unverified.
func TestLSPHintsRefreshKeepsEachProducerIsolated(t *testing.T) {
  var log bytes.Buffer
  first := NativeLSPPluginEntry{Binary: "ttsc-no-such-plugin-binary-a", Name: "@ttsc/lint"}
  second := NativeLSPPluginEntry{Binary: "ttsc-no-such-plugin-binary-b", Name: "@samchon/evidence"}
  for _, binary := range []string{first.Binary, second.Binary} {
    if _, err := exec.LookPath(binary); err == nil {
      t.Fatalf("missing sidecar premise failed: %q resolves to an executable", binary)
    }
  }
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
  if !reflect.DeepEqual(hints, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "param"}}},
    {Scope: "jsdoc", After: "@evidence ", Items: []LSPCompletionItem{{Insert: "docs/rfc.md"}}},
  }) {
    t.Errorf("failed discovery changed the literal producer corpora: %#v", hints)
  }
  if log.Len() != 0 {
    t.Errorf(
      "unresolved producer discovery wrote unexpected log bytes:\n%s",
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
  if !reflect.DeepEqual(hints, []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "param"}, {Insert: "returns"}}},
    {Scope: "jsdoc", After: "@evidence ", Items: []LSPCompletionItem{{Insert: "docs/rfc.md"}}},
  }) {
    t.Errorf("direct store changed the expected producer corpora: %#v", hints)
  }
}
