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
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must return a no-op Doc and covered true for an absent node.
// @evidence contracts/testing.md#independent-expectations An absent subtree contributes no bytes and contains no unsupported multiline content, independently establishing both outputs.
// @evidence contracts/testing.md#distinguishing-cases The nil dispatcher identity complements nonempty covered layouts and uncovered comment/multiline subtrees.
// @evidence contracts/testing.md#execution-ownership TestPrintNodeReturnsEmptyForNilNode is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
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
