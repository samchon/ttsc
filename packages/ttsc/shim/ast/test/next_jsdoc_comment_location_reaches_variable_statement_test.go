package ast_test

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// Verifies JSDoc attachment traversal reaches the first variable's statement.
//
// Public linkage alone cannot show that a parent traversal reaches its required
// endpoint or that later declarations remain outside the shared comment host.
//
//  1. Build and parent-link a statement containing two initialized declarations.
//  2. Traverse the first initializer through its declaration and list to the statement.
//  3. Require termination at the statement and rejection of the second declaration.
//
// @evidence contracts/testing.md#behavioral-verification The real public shim traversal follows factory-built parent links and must return the exact containing statement after all three hops.
// @evidence contracts/testing.md#independent-expectations Explicitly retained initializer, declaration, list and statement pointers establish each expected endpoint independently of traversal output.
// @evidence contracts/testing.md#distinguishing-cases First and second declarations distinguish the attachment boundary, while a detached initializer and statement root distinguish nil termination from unbounded ancestry.
// @evidence contracts/testing.md#execution-ownership The existing shim/ast/test source-unit runner executes the actual AST factory, parent wiring and traversal in one Go process with no filesystem fixture or compiler producer.
func TestNextJSDocCommentLocationReachesVariableStatement(t *testing.T) {
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  firstInitializer := factory.NewNumericLiteral("1", shimast.TokenFlagsNone)
  secondInitializer := factory.NewNumericLiteral("2", shimast.TokenFlagsNone)
  first := factory.NewVariableDeclaration(factory.NewIdentifier("first"), nil, nil, firstInitializer)
  second := factory.NewVariableDeclaration(factory.NewIdentifier("second"), nil, nil, secondInitializer)
  list := factory.NewVariableDeclarationList(factory.NewNodeList([]*shimast.Node{first, second}), shimast.NodeFlagsConst)
  statement := factory.NewVariableStatement(nil, list)
  shimast.SetParentInChildren(statement)
  node := firstInitializer
  for index, expected := range []*shimast.Node{first, list, statement} {
    node = shimast.GetNextJSDocCommentLocation(node)
    if node != expected {
      t.Fatalf("attachment hop %d = %p, want %p", index+1, node, expected)
    }
  }
  if got := shimast.GetNextJSDocCommentLocation(statement); got != nil {
    t.Fatalf("statement root advanced to %p", got)
  }
  if got := shimast.GetNextJSDocCommentLocation(secondInitializer); got != second {
    t.Fatalf("second initializer host = %p, want its declaration %p", got, second)
  }
  if got := shimast.GetNextJSDocCommentLocation(second); got != nil {
    t.Fatalf("later declaration advanced to shared list %p", got)
  }
  detached := factory.NewNumericLiteral("3", shimast.TokenFlagsNone)
  if got := shimast.GetNextJSDocCommentLocation(detached); got != nil {
    t.Fatalf("detached node advanced to %p", got)
  }
}
