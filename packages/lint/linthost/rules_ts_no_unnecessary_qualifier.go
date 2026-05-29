// typescript/no-unnecessary-qualifier: a qualified reference like
// `Foo.Bar` written inside `namespace Foo { ... }` (or `enum Foo { ...,
// X = Foo.Y, ... }`) names the same scope the reference is already in.
// The qualifier adds no information; dropping `Foo.` leaves the
// identical binding lookup. typescript-eslint:
// https://typescript-eslint.io/rules/no-unnecessary-qualifier/
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noUnnecessaryQualifier inspects every two-segment qualified reference
// whose head is a plain identifier — `QualifiedName` shows up in type
// position (`Foo.Bar` inside a type annotation) and
// `PropertyAccessExpression` shows up in value position. The check is
// AST-only: it walks the ancestor chain for an enclosing `namespace
// <head> { ... }` or `enum <head> { ... }` declaration and reports when
// one is found. The rule deliberately does not consult the Checker
// because the upstream rule operates on lexical scope identity, which
// the AST already encodes via declaration ancestry.
type noUnnecessaryQualifier struct{}

func (noUnnecessaryQualifier) Name() string {
  return "typescript/no-unnecessary-qualifier"
}
func (noUnnecessaryQualifier) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindQualifiedName,
    shimast.KindPropertyAccessExpression,
  }
}
func (noUnnecessaryQualifier) Check(ctx *Context, node *shimast.Node) {
  head := noUnnecessaryQualifierHead(node)
  if head == "" {
    return
  }
  if !noUnnecessaryQualifierHasEnclosingScope(node, head) {
    return
  }
  ctx.Report(node, "Qualifier `"+head+"` is the enclosing namespace or enum — drop the qualifier.")
}

// noUnnecessaryQualifierHead returns the LHS identifier text when the
// node is a two-segment qualified reference (`A.B`) whose head is a
// plain identifier. Returns "" for nested chains (`A.B.C`), computed
// accesses, or non-identifier heads — those shapes don't match the
// "qualifier names the enclosing scope" pattern.
func noUnnecessaryQualifierHead(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindQualifiedName:
    qn := node.AsQualifiedName()
    if qn == nil || qn.Left == nil {
      return ""
    }
    if qn.Left.Kind != shimast.KindIdentifier {
      return ""
    }
    return identifierText(qn.Left)
  case shimast.KindPropertyAccessExpression:
    pa := node.AsPropertyAccessExpression()
    if pa == nil || pa.Expression == nil || pa.Name() == nil {
      return ""
    }
    // Optional chains (`Foo?.Bar`) aren't redundant in the same
    // sense — the `?.` changes runtime behavior, so leave them be.
    if pa.QuestionDotToken != nil {
      return ""
    }
    if pa.Expression.Kind != shimast.KindIdentifier {
      return ""
    }
    return identifierText(pa.Expression)
  }
  return ""
}

// noUnnecessaryQualifierHasEnclosingScope reports whether `node`
// appears inside a `namespace <head> { ... }` or `enum <head> { ... }`
// declaration body. The walk climbs `Parent` links until it finds a
// matching block or hits the SourceFile root.
func noUnnecessaryQualifierHasEnclosingScope(node *shimast.Node, head string) bool {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    switch cur.Kind {
    case shimast.KindModuleDeclaration:
      decl := cur.AsModuleDeclaration()
      if decl == nil || decl.Name() == nil {
        continue
      }
      // `declare module "fs"` carries a string-literal name and
      // does not bind an identifier in the surrounding scope —
      // skip those entirely. The rule only fires when the head
      // matches the enclosing namespace's identifier name.
      if decl.Name().Kind != shimast.KindIdentifier {
        continue
      }
      if identifierText(decl.Name()) == head {
        return true
      }
    case shimast.KindEnumDeclaration:
      decl := cur.AsEnumDeclaration()
      if decl == nil || decl.Name() == nil {
        continue
      }
      if identifierText(decl.Name()) == head {
        return true
      }
    }
  }
  return false
}

func init() {
  Register(noUnnecessaryQualifier{})
}
