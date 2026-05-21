package linthost

import "testing"

// TestDocJoinReturnsNilForEmptyParts verifies Join returns a no-op nil
// doc when called with an empty slice, and that Print emits an empty
// string for it.
//
// Callers that dynamically collect parts (e.g. dispatch_named_imports)
// may end up with a zero-length slice when the import list is empty.
// The nil return lets callers pass the result straight to Print or to
// another constructor without a nil-guard at each call site. A
// regression that panicked on an empty slice, or that emitted a
// non-empty token for it, would break every import/export list printer
// that can legally have zero entries.
//
//  1. Call Join with any separator and an empty []Doc{}.
//  2. Assert the returned doc's IsNil() is true.
//  3. Print the nil doc and assert the output is an empty string.
func TestDocJoinReturnsNilForEmptyParts(t *testing.T) {
  doc := Join(Text(", "), []Doc{})
  if !doc.IsNil() {
    t.Fatalf("Join with empty parts: IsNil() = false, want true (Kind=%v)", doc.Kind)
  }
  got := Print(doc, DefaultPrintOptions())
  if got != "" {
    t.Fatalf("Join with empty parts: Print output %q, want empty string", got)
  }
}
