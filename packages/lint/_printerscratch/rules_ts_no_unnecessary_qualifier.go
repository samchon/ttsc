// typescript/no-unnecessary-qualifier: a qualified reference like
// `Foo.Bar` written inside `namespace Foo { ... }` (or `enum Foo { ...,
// X = Foo.Y, ... }`) is redundant only when the unqualified name `Bar`
// resolves, from the same location, to the exact same binding the
// qualifier reaches. typescript-eslint:
// https://typescript-eslint.io/rules/no-unnecessary-qualifier/
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noUnnecessaryQualifier inspects every two-segment qualified reference
// whose head is a plain identifier — `QualifiedName` shows up in type
// position (`Foo.Bar` inside a type annotation) and
// `PropertyAccessExpression` shows up in value position.
//
// The check is type-aware, mirroring the upstream rule's
// `qualifierIsUnnecessary`: text identity alone is not enough because a
// qualifier can be load-bearing. `Foo.` is redundant only when
//
//  1. the head identifier resolves to a namespace/enum symbol that is
//     declared by one of the declarations enclosing the access
//     (`symbolIsNamespaceInScope`), and
//  2. the member name, looked up unqualified from the head's location,
//     resolves to the same symbol the qualified access reaches
//     (`getSymbolsInScope` + export-symbol equality).
//
// The second clause is what keeps a shadowed member (`const bar` hiding
// `Foo.bar`) or a shadowed namespace name (`const Foo = { bar }`) from
// being reported — dropping such a qualifier would silently change which
// binding the code reads.
type noUnnecessaryQualifier struct{}

func (noUnnecessaryQualifier) Name() string {
  return "typescript/no-unnecessary-qualifier"
}

// NeedsTypeChecker marks the rule type-aware: it resolves the head and
// member symbols and enumerates the in-scope bindings through
// Context.Checker, so the engine must acquire a checker for it.
func (noUnnecessaryQualifier) NeedsTypeChecker() bool {
  return true
}

func (noUnnecessaryQualifier) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindQualifiedName,
    shimast.KindPropertyAccessExpression,
  }
}
func (noUnnecessaryQualifier) Check(ctx *Context, node *shimast.Node) {
  head, name := noUnnecessaryQualifierParts(node)
  if head == nil || name == nil {
    return
  }
  if !noUnnecessaryQualifierIsUnnecessary(ctx, node, head, name) {
    return
  }
  ctx.Report(node, "Qualifier `"+identifierText(head)+"` is the enclosing namespace or enum — drop the qualifier.")
}

// noUnnecessaryQualifierParts returns the head (qualifier) and member
// name nodes of a two-segment qualified reference (`A.B`) whose head is a
// plain identifier. Returns (nil, nil) for nested chains (`A.B.C`),
// computed accesses, or non-identifier heads — those shapes don't match
// the "qualifier names the enclosing scope" pattern.
func noUnnecessaryQualifierParts(node *shimast.Node) (head *shimast.Node, name *shimast.Node) {
  if node == nil {
    return nil, nil
  }
  switch node.Kind {
  case shimast.KindQualifiedName:
    qn := node.AsQualifiedName()
    if qn == nil || qn.Left == nil || qn.Right == nil {
      return nil, nil
    }
    if qn.Left.Kind != shimast.KindIdentifier {
      return nil, nil
    }
    return qn.Left, qn.Right
  case shimast.KindPropertyAccessExpression:
    pa := node.AsPropertyAccessExpression()
    if pa == nil || pa.Expression == nil || pa.Name() == nil {
      return nil, nil
    }
    // Optional chains (`Foo?.Bar`) aren't redundant in the same
    // sense — the `?.` changes runtime behavior, so leave them be.
    if pa.QuestionDotToken != nil {
      return nil, nil
    }
    if pa.Expression.Kind != shimast.KindIdentifier {
      return nil, nil
    }
    return pa.Expression, pa.Name()
  }
  return nil, nil
}

// noUnnecessaryQualifierIsUnnecessary is the Go port of upstream
// `qualifierIsUnnecessary`. It reports whether dropping the `head.`
// qualifier leaves the identical binding lookup.
func noUnnecessaryQualifierIsUnnecessary(ctx *Context, node *shimast.Node, head *shimast.Node, name *shimast.Node) bool {
  if ctx == nil || ctx.Checker == nil {
    return false
  }
  // The cheap AST walk short-circuits before any checker call: the vast
  // majority of qualified references in a program sit outside every
  // namespace/enum, so an empty enclosing set rules them out without
  // resolving a symbol.
  enclosing := noUnnecessaryQualifierEnclosingNamespaces(node)
  if len(enclosing) == 0 {
    return false
  }
  namespaceSymbol := ctx.Checker.GetSymbolAtLocation(head)
  if namespaceSymbol == nil {
    return false
  }
  if !noUnnecessaryQualifierSymbolIsNamespaceInScope(ctx, enclosing, namespaceSymbol, 0) {
    return false
  }
  accessedSymbol := ctx.Checker.GetSymbolAtLocation(name)
  if accessedSymbol == nil {
    return false
  }
  fromScope := noUnnecessaryQualifierSymbolInScope(ctx, head, accessedSymbol.Flags, identifierText(name))
  if fromScope == nil {
    return false
  }
  // Upstream `symbolsAreEqual`: the unqualified lookup must reach the
  // same symbol as the qualified access. Normalizing the in-scope
  // symbol to its export symbol collapses the local/export duality that
  // a namespace or enum member carries.
  return accessedSymbol == ctx.Checker.GetExportSymbolOfSymbol(fromScope)
}

// noUnnecessaryQualifierEnclosingNamespaces collects the `namespace`
// (`ModuleDeclaration`) and `enum` (`EnumDeclaration`) declaration nodes
// that enclose `node`, mirroring the upstream `namespacesInScope` stack.
// The walk climbs `Parent` links until it hits the SourceFile root.
func noUnnecessaryQualifierEnclosingNamespaces(node *shimast.Node) []*shimast.Node {
  var enclosing []*shimast.Node
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    switch cur.Kind {
    case shimast.KindModuleDeclaration, shimast.KindEnumDeclaration:
      enclosing = append(enclosing, cur)
    }
  }
  return enclosing
}

// noUnnecessaryQualifierSymbolIsNamespaceInScope is the Go port of
// upstream `symbolIsNamespaceInScope`: it reports whether `symbol` is one
// of the namespaces/enums currently in scope by checking its declarations
// against `enclosing`, following aliases when the direct declarations
// don't match. The depth guard bounds pathological alias cycles.
func noUnnecessaryQualifierSymbolIsNamespaceInScope(ctx *Context, enclosing []*shimast.Node, symbol *shimast.Symbol, depth int) bool {
  if symbol == nil || depth > 16 {
    return false
  }
  for _, decl := range symbol.Declarations {
    for _, ns := range enclosing {
      if decl == ns {
        return true
      }
    }
  }
  if symbol.Flags&shimast.SymbolFlagsAlias != 0 {
    alias := ctx.Checker.GetAliasedSymbol(symbol)
    if alias != nil && alias != symbol {
      return noUnnecessaryQualifierSymbolIsNamespaceInScope(ctx, enclosing, alias, depth+1)
    }
  }
  return false
}

// noUnnecessaryQualifierSymbolInScope is the Go port of upstream
// `getSymbolInScope`: it returns the first symbol named `name` that the
// checker reports as visible (with the given meaning `flags`) from the
// `head` location, or nil when the name is not in scope.
func noUnnecessaryQualifierSymbolInScope(ctx *Context, head *shimast.Node, flags shimast.SymbolFlags, name string) *shimast.Symbol {
  if name == "" {
    return nil
  }
  for _, symbol := range ctx.Checker.GetSymbolsInScope(head, flags) {
    if symbol != nil && symbol.Name == name {
      return symbol
    }
  }
  return nil
}

func init() {
  Register(noUnnecessaryQualifier{})
}
