package ast_test

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNodeTextJoinsOneHopQualifiedName verifies NodeText joins a one-hop
// QualifiedName as "left.right".
//
// Locks the QualifiedName arm that upstream lacks: upstream's
// (*Node).Text() panics with `Unhandled case in Node.Text:
// *ast.QualifiedName` because the switch has no arm for the Kind. typia's
// metadata_js_doc_parameter_name calls Text() on a JSDoc tag's Name()
// which is a QualifiedName for `@param obj.field description`, so the
// panic surfaces inside the nestia/typia build pipeline. NodeText must
// turn a `Foo.Bar` qualified name into the dotted string.
//
// 1. Construct Foo.Bar via NewQualifiedName(Foo, Bar).
// 2. Call NodeText on the qualified node.
// 3. Assert the result is "Foo.Bar".
func TestNodeTextJoinsOneHopQualifiedName(t *testing.T) {
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  left := factory.NewIdentifier("Foo")
  right := factory.NewIdentifier("Bar")
  qn := factory.NewQualifiedName(left, right)
  if got := shimast.NodeText(qn); got != "Foo.Bar" {
    t.Fatalf("NodeText(Foo.Bar) = %q, want %q", got, "Foo.Bar")
  }
}
