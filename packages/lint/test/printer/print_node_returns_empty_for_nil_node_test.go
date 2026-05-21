package linthost

import "testing"

// TestPrintNodeReturnsEmptyForNilNode verifies that PrintNode returns a
// zero Doc and covered=true when the supplied node pointer is nil.
//
// The nil guard is the first statement in PrintNode. Without it, the
// dispatcher would dereference a nil pointer to read node.Kind and panic.
// The guard reports covered=true: a nil node contributes no bytes, so the
// printed subtree stays trivially reflow-safe.
//
//  1. Parse any valid TypeScript source so a PrintContext is available.
//  2. Call PrintNode with a nil node.
//  3. Assert both returns: Doc{} (zero value) and covered == true.
func TestPrintNodeReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, nil)
  if !doc.IsNil() {
    t.Fatalf("want nil Doc for nil node, got Kind=%d", doc.Kind)
  }
  if !covered {
    t.Fatal("want covered=true for nil node, got false")
  }
}
