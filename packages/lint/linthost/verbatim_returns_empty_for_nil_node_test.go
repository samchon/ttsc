package linthost

import "testing"

// TestVerbatimReturnsEmptyForNilNode verifies that verbatim returns a
// zero Doc when passed a nil node pointer.
//
// The verbatim helper is called from both PrintNode's fallback arm and
// from per-node printers that delegate sub-expressions. A nil sub-node
// (e.g. an optional callee or question-dot token) must produce an empty
// Doc rather than a panic. The guard is the first check inside verbatim
// and must be exercised independently of the PrintNode nil guard, because
// per-node printers call verbatim directly without going through PrintNode.
//
//  1. Parse any valid TypeScript source so a PrintContext is available.
//  2. Call verbatim directly with a nil node.
//  3. Assert the returned Doc has the nil discriminator through IsNil.
//
// @evidence contracts/testing.md#behavioral-verification verbatim must return a no-op Doc for an absent source node.
// @evidence contracts/testing.md#independent-expectations No node provides a source span, so the layout identity is the supported safe result.
// @evidence contracts/testing.md#distinguishing-cases Nil-node source copying complements out-of-range rejection and nonempty unknown-kind verbatim preservation.
// @evidence contracts/testing.md#execution-ownership TestVerbatimReturnsEmptyForNilNode is one Go unit entry that parses a trivial source for a PrintContext and calls the unexported verbatim with a nil node in-process; it installs, builds and launches nothing.
func TestVerbatimReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc := verbatim(ctx, nil)
  if !doc.IsNil() {
    t.Fatalf("want nil Doc for nil node, got Kind=%d", doc.Kind)
  }
}
