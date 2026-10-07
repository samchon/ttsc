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

// noUnnecessaryTypeArguments compares explicit arguments in type references,
// heritage, calls and construction against their owning generic's defaults.
// Function and class value instantiations retain their specialization arguments.
// The checker resolves aliases and selects callable signatures; the AST alone
// does not identify which declaration owns the argument list.
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
  params := noUnnecessaryTypeArgumentsResolveParameters(ctx, node, nameNode)
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
    // A value instantiation such as make<string> specializes a generic value.
    // Removing its arguments changes that value's callable/constructable type.
    // Heritage is the expression-shaped position whose omitted arguments may
    // instead be supplied by the declaration's defaults.
    if node.Parent == nil || node.Parent.Kind != shimast.KindHeritageClause {
      return nil, nil
    }
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

// noUnnecessaryTypeArgumentsResolveParameters uses the selected signature for
// calls, and the aliased type declaration for references and heritage. New
// expressions may inherit their generic parameters from the constructed class
// rather than its constructor declaration. Missing or unresolved declarations
// leave no default against which the rule can compare.
func noUnnecessaryTypeArgumentsResolveParameters(ctx *Context, node, nameNode *shimast.Node) []*shimast.TypeParameterDeclaration {
  if node.Kind == shimast.KindCallExpression || node.Kind == shimast.KindNewExpression {
    if signature := ctx.Checker.GetResolvedSignature(node); signature != nil {
      if params := noUnnecessaryTypeArgumentsParamList(signature.Declaration()); len(params) != 0 {
        return params
      }
    }
    if node.Kind == shimast.KindCallExpression {
      return nil
    }
  }
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
  if symbol != nil && symbol.Flags&shimast.SymbolFlagsAlias != 0 {
    symbol = ctx.Checker.GetAliasedSymbol(symbol)
  }
  if symbol == nil {
    return nil
  }
  for _, decl := range symbol.Declarations {
    switch decl.Kind {
    case shimast.KindClassDeclaration, shimast.KindClassExpression,
      shimast.KindInterfaceDeclaration, shimast.KindTypeAliasDeclaration:
      if list := noUnnecessaryTypeArgumentsParamList(decl); list != nil {
        return list
      }
    }
  }
  return nil
}

// noUnnecessaryTypeArgumentsParamList returns the type-parameter list on
// `decl` when the declaration kind carries one, or nil otherwise. The
// type and class kinds have their own parameter lists; the compiler's nullable
// FunctionLikeData view supplies callable and constructable signature lists
// without an unchecked cast to one particular function-shaped declaration.
func noUnnecessaryTypeArgumentsParamList(decl *shimast.Node) []*shimast.TypeParameterDeclaration {
  if decl == nil {
    return nil
  }
  var list *shimast.TypeParameterList
  switch decl.Kind {
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
  default:
    if function := decl.FunctionLikeData(); function != nil {
      list = function.TypeParameters
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
