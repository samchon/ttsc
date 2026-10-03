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
//
// @evidence contracts/testing.md#behavioral-verification NodeText joins the factory-built Foo.Bar qualified-name kind that lacks an upstream Text arm.
// @evidence contracts/testing.md#independent-expectations The literal Foo.Bar expectation fixes the separator and both node payloads independently.
// @evidence contracts/testing.md#distinguishing-cases A real qualified node distinguishes safe shim dispatch from a delegated upstream panic or identifier-only output.
// @evidence contracts/testing.md#execution-ownership The shim and real AST factory execute in-process; typia and nestia integration remain distinct CI consumers.
func TestNodeTextJoinsOneHopQualifiedName(t *testing.T) {
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  left := factory.NewIdentifier("Foo")
  right := factory.NewIdentifier("Bar")
  qn := factory.NewQualifiedName(left, right)
  if got := shimast.NodeText(qn); got != "Foo.Bar" {
    t.Fatalf("NodeText(Foo.Bar) = %q, want %q", got, "Foo.Bar")
  }
}
