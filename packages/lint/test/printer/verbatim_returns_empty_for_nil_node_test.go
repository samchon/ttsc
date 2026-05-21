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
//  3. Assert the returned Doc equals the zero value.
func TestVerbatimReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc := verbatim(ctx, nil)
  if !doc.IsNil() {
    t.Fatalf("want nil Doc for nil node, got Kind=%d", doc.Kind)
  }
}
