// noFuncAssign rejects writes to bindings introduced by function declarations
// and named function expressions. It follows checker symbols instead of names,
// so hoisted references resolve correctly while parameter, catch, block, and
// sibling-scope shadows remain independent.
// https://eslint.org/docs/latest/rules/no-func-assign
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type noFuncAssign struct{}

func (noFuncAssign) Name() string           { return "no-func-assign" }
func (noFuncAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (noFuncAssign) NeedsTypeChecker() bool { return true }
func (noFuncAssign) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.Checker == nil || node == nil {
    return
  }

  functionSymbols := make(map[*shimast.Symbol]struct{})
  walkDescendants(node, func(child *shimast.Node) {
    name := noFuncAssignDeclarationName(child)
    symbol := canonicalValueSymbol(ctx, name)
    if symbol != nil {
      functionSymbols[symbol] = struct{}{}
    }
  })
  if len(functionSymbols) == 0 {
    return
  }

  reported := make(map[*shimast.Node]struct{})
  walkDescendants(node, func(child *shimast.Node) {
    for _, target := range writeTargetIdentifiers(child) {
      if _, duplicate := reported[target]; duplicate {
        continue
      }
      symbol := canonicalValueSymbol(ctx, target)
      if _, isFunction := functionSymbols[symbol]; !isFunction {
        continue
      }
      reported[target] = struct{}{}
      ctx.Report(target, "'"+identifierText(target)+"' is a function.")
    }
  })
}

// noFuncAssignDeclarationName returns the value-binding name introduced by a
// function declaration or named function expression. Anonymous expressions do
// not introduce a function-name binding.
func noFuncAssignDeclarationName(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    if declaration := node.AsFunctionDeclaration(); declaration != nil {
      return declaration.Name()
    }
  case shimast.KindFunctionExpression:
    if expression := node.AsFunctionExpression(); expression != nil {
      return expression.Name()
    }
  }
  return nil
}

func init() {
  Register(noFuncAssign{})
}
