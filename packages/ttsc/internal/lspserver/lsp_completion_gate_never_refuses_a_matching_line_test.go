package lspserver

import "testing"

// TestLSPCompletionGateNeverRefusesAMatchingLine verifies the cheap line test
// that now guards the document scan admits everything the full match would.
//
// completionItemsFor decides the cursor's lexical scope by scanning the document
// from byte zero, and that answer is only ever read by a hint whose trigger is
// already on the current line. The gate skips the scan when no trigger is, so it
// must never be stricter than the match it precedes: a false where
// matchCompletionHints would have produced items is a hint silently lost.
//
//  1. Publish a layered corpus: a broad trigger and two narrower ones.
//  2. For each candidate line, run the gate and the full match together.
//  3. Assert the gate is open wherever the match produced items, and closed on
//     lines holding no trigger at all.
//
// @evidence contracts/testing.md#behavioral-verification For each candidate line the cheap trigger gate is open wherever the full hint match produces items and closed on lines holding no trigger.
// @evidence contracts/testing.md#independent-expectations The oracle is the full matcher run on the same line, so the gate is checked against an independent, stricter implementation.
// @evidence contracts/testing.md#distinguishing-cases A layered corpus of broad and narrow triggers and lines with and without any trigger separate a too-strict gate from a correct one.
// @evidence contracts/testing.md#execution-ownership TestLSPCompletionGateNeverRefusesAMatchingLine is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestLSPCompletionGateNeverRefusesAMatchingLine(t *testing.T) {
  hints := []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "param"}}},
    {Scope: "jsdoc", After: "@evidence ", Items: []LSPCompletionItem{{Insert: "docs/spec.md"}}},
    {Scope: "jsdoc", After: "@evidence docs/spec.md#", Items: []LSPCompletionItem{{Insert: "pricing"}}},
    // Refused by the match for want of items; must not open the gate either.
    {Scope: "jsdoc", After: "@nothing", Items: nil},
    // An empty trigger matches every line; the match refuses it, so must the gate.
    {Scope: "jsdoc", After: "", Items: []LSPCompletionItem{{Insert: "never"}}},
  }

  for _, entry := range []struct {
    line string
    open bool
  }{
    {" * @par", true},
    {" * @evidence docs/sp", true},
    {" * @evidence docs/spec.md#pri", true},
    {" * plain prose with no tag", false},
    {"", false},
    {"const value = 1;", false},
    {" * @nothing here", true}, // the broad "@" trigger still applies
  } {
    gate := anyCompletionHintCouldApply(hints, entry.line)
    if gate != entry.open {
      t.Fatalf("gate for %q: want %v, got %v", entry.line, entry.open, gate)
    }
    items, _ := matchCompletionHints(hints, entry.line, true)
    if len(items) > 0 && !gate {
      t.Fatalf("gate closed on %q while the match produced %d items", entry.line, len(items))
    }
  }
}
