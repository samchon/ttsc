package linthost

import "testing"

// TestDocJoinReturnsNilForEmptyParts verifies Join returns a no-op docNil
// Doc value when called with an empty slice, and that Print emits an empty
// string for it.
//
// The empty-slice identity is part of Join's documented contract. This
// Doc value can be passed straight to Print or another constructor;
// it is not a nil pointer. The only in-package caller,
// printListPlain, receives non-empty items because printList returns before
// it for an empty list, so this case pins the helper's contract rather than a
// path the printers take today.
//
//  1. Call Join with any separator and an empty []Doc{}.
//  2. Assert the returned doc's IsNil() is true.
//  3. Print the no-op Doc and assert the output is an empty string.
//
// @evidence contracts/testing.md#behavioral-verification Join of zero parts must be a no-op Doc and Print must emit no separator or payload.
// @evidence contracts/testing.md#independent-expectations Empty sequence identity requires no output; both the IsNil verdict and empty rendering are observed independently.
// @evidence contracts/testing.md#distinguishing-cases This zero-cardinality boundary complements ordinary nonempty argument-list printing, which retains separators.
// @evidence contracts/testing.md#execution-ownership TestDocJoinReturnsNilForEmptyParts is one Go unit entry that calls Join with an empty slice and renders the result with Print in-process; it parses no source and installs, builds and launches nothing.
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
