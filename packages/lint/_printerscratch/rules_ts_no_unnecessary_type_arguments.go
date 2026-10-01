// typescript/no-unnecessary-type-arguments: when a generic's explicit
// type argument matches the corresponding parameter's declared default,
// the argument is just restating the default. Dropping it leaves the
// identical type because TypeScript would substitute the default
// anyway. typescript-eslint:
// https://typescript-eslint.io/rules/no-unnecessary-type-arguments/
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noUnnecessaryTypeArguments visits the three syntactic positions that
// carry an explicit type-argument list — `Foo<T>` in type position,
// `new Foo<T>(…)`, and `foo<T>(…)` — and compares each argument against
// the parameter default declared on the generic. The check is type-aware
// because matching against the default requires resolving the generic's
// symbol back to its parameter list; the AST alone doesn't carry that
// link.
//
// The rule reports the rightmost run of arguments that equal their
// defaults: a trailing default-equal arg can be dropped without
// affecting the leftmost positional args. Once a non-equal arg appears
// scanning from the right, every argument to its left must stay
// explicit even when it equals its own default — TypeScript can only
// omit a contiguous suffix.
type noUnnecessaryTypeArguments struct{}

func (noUnnecessaryTypeArguments) Name() string {
  return "typescript/no-unnecessary-type-arguments"
}
func (noUnnecessaryTypeArguments) NeedsTypeChecker() bool {
  return true
}
func (noUnnecessaryTypeArguments) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindTypeReference,
    shimast.KindExpressionWithTypeArguments,
    shimast.KindCallExpression,
    shimast.KindNewExpression,
  }
}
func (noUnnecessaryTypeArguments) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  args, nameNode := noUnnecessaryTypeArgumentsExtract(node)
  if len(args) == 0 || nameNode == nil {
    return
  }
  params := noUnnecessaryTypeArgumentsResolveParameters(ctx, nameNode)
  if len(params) == 0 {
    return
  }
  // Walk from the right: report contiguous trailing args that equal
  // their declared defaults. Stop at the first mismatch — only the
  // suffix is droppable.
  for i := len(args) - 1; i >= 0; i-- {
    if i >= len(params) {
      continue
    }
    param := params[i]
    if param == nil {
      break
    }
    defaultNode := param.DefaultType
    if defaultNode == nil {
      break
    }
    argNode := args[i]
    if argNode == nil {
      break
    }
    argType := ctx.Checker.GetTypeFromTypeNode(argNode)
    defaultType := ctx.Checker.GetTypeFromTypeNode(defaultNode)
    if argType == nil || defaultType == nil {
      break
    }
    if !ctx.Checker.IsTypeAssignableTo(argType, defaultType) {
      break
    }
    if !ctx.Checker.IsTypeAssignableTo(defaultType, argType) {
      break
    }
    ctx.Report(argNode, "This type argument equals the declared default — drop it.")
  }
}

// noUnnecessaryTypeArgumentsExtract returns the explicit type-argument
// nodes and the identifier-or-property-access naming the generic the
// arguments apply to. Returns (nil, nil) when the node carries no
// explicit type arguments — the rule only fires on opt-in argument
// lists.
func noUnnecessaryTypeArgumentsExtract(node *shimast.Node) ([]*shimast.Node, *shimast.Node) {
  switch node.Kind {
  case shimast.KindTypeReference:
    ref := node.AsTypeReferenceNode()
    if ref == nil || ref.TypeArguments == nil {
      return nil, nil
    }
    return ref.TypeArguments.Nodes, ref.TypeName
  case shimast.KindExpressionWithTypeArguments:
    ewta := node.AsExpressionWithTypeArguments()
    if ewta == nil || ewta.TypeArguments == nil {
      return nil, nil
    }
    return ewta.TypeArguments.Nodes, ewta.Expression
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil || call.TypeArguments == nil {
      return nil, nil
    }
    return call.TypeArguments.Nodes, call.Expression
  case shimast.KindNewExpression:
    ne := node.AsNewExpression()
    if ne == nil || ne.TypeArguments == nil {
      return nil, nil
    }
    return ne.TypeArguments.Nodes, ne.Expression
  }
  return nil, nil
}

// noUnnecessaryTypeArgumentsResolveParameters resolves `nameNode` to a
// symbol and returns the type parameters declared on the first
// declaration that carries one. Returns nil when the symbol does not
// resolve or no declaration carries a type-parameter list — the rule
// then has nothing to compare against.
func noUnnecessaryTypeArgumentsResolveParameters(ctx *Context, nameNode *shimast.Node) []*shimast.TypeParameterDeclaration {
  if nameNode == nil {
    return nil
  }
  target := nameNode
  // For property accesses (`a.b.Foo<T>`) the symbol-bearing identifier
  // is the rightmost name, not the dotted root.
  if target.Kind == shimast.KindPropertyAccessExpression {
    access := target.AsPropertyAccessExpression()
    if access == nil || access.Name() == nil {
      return nil
    }
    target = access.Name()
  } else if target.Kind == shimast.KindQualifiedName {
    qn := target.AsQualifiedName()
    if qn == nil || qn.Right == nil {
      return nil
    }
    target = qn.Right
  }
  symbol := ctx.Checker.GetSymbolAtLocation(target)
  if symbol == nil {
    return nil
  }
  for _, decl := range symbol.Declarations {
    if list := noUnnecessaryTypeArgumentsParamList(decl); list != nil {
      return list
    }
  }
  return nil
}

// noUnnecessaryTypeArgumentsParamList returns the type-parameter list on
// `decl` when the declaration kind carries one, or nil otherwise. The
// enumerated kinds match the host types TypeScript binds generic
// arguments against — function-shaped declarations, class / interface
// / alias declarations, and the method-like signatures that may appear
// inside them.
func noUnnecessaryTypeArgumentsParamList(decl *shimast.Node) []*shimast.TypeParameterDeclaration {
  if decl == nil {
    return nil
  }
  var list *shimast.TypeParameterList
  switch decl.Kind {
  case shimast.KindFunctionDeclaration:
    if d := decl.AsFunctionDeclaration(); d != nil {
      list = d.TypeParameters
    }
  case shimast.KindClassDeclaration:
    if d := decl.AsClassDeclaration(); d != nil {
      list = d.TypeParameters
    }
  case shimast.KindClassExpression:
    if d := decl.AsClassExpression(); d != nil {
      list = d.TypeParameters
    }
  case shimast.KindInterfaceDeclaration:
    if d := decl.AsInterfaceDeclaration(); d != nil {
      list = d.TypeParameters
    }
  case shimast.KindTypeAliasDeclaration:
    if d := decl.AsTypeAliasDeclaration(); d != nil {
      list = d.TypeParameters
    }
  case shimast.KindMethodDeclaration:
    if d := decl.AsMethodDeclaration(); d != nil {
      list = d.TypeParameters
    }
  case shimast.KindMethodSignature:
    if d := decl.AsMethodSignatureDeclaration(); d != nil {
      list = d.TypeParameters
    }
  case shimast.KindFunctionExpression:
    if d := decl.AsFunctionExpression(); d != nil {
      list = d.TypeParameters
    }
  case shimast.KindArrowFunction:
    if d := decl.AsArrowFunction(); d != nil {
      list = d.TypeParameters
    }
  case shimast.KindCallSignature:
    if d := decl.AsCallSignatureDeclaration(); d != nil {
      list = d.TypeParameters
    }
  case shimast.KindConstructSignature:
    if d := decl.AsConstructSignatureDeclaration(); d != nil {
      list = d.TypeParameters
    }
  }
  if list == nil || len(list.Nodes) == 0 {
    return nil
  }
  out := make([]*shimast.TypeParameterDeclaration, 0, len(list.Nodes))
  for _, n := range list.Nodes {
    if n == nil {
      out = append(out, nil)
      continue
    }
    out = append(out, n.AsTypeParameterDeclaration())
  }
  return out
}

func init() {
  Register(noUnnecessaryTypeArguments{})
}
