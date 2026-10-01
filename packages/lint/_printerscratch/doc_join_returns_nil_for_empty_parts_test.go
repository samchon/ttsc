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
//
// @evidence contracts/testing.md#behavioral-verification Join of zero parts must be a no-op Doc and Print must emit no separator or payload.
// @evidence contracts/testing.md#independent-expectations Empty sequence identity requires no output; both the IsNil verdict and empty rendering are observed independently.
// @evidence contracts/testing.md#distinguishing-cases This zero-cardinality boundary complements ordinary nonempty argument-list printing, which retains separators.
// @evidence contracts/testing.md#execution-ownership TestDocJoinReturnsNilForEmptyParts is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
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
