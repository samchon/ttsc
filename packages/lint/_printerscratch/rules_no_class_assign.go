// noClassAssign rejects writes to bindings introduced by class declarations
// and named class expressions. It follows checker symbols instead of names,
// so references inside the class and in its surrounding scope resolve while
// parameter, catch, block, and sibling-scope shadows remain independent.
// https://eslint.org/docs/latest/rules/no-class-assign
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type noClassAssign struct{}

func (noClassAssign) Name() string           { return "no-class-assign" }
func (noClassAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (noClassAssign) NeedsTypeChecker() bool { return true }
func (noClassAssign) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.Checker == nil || node == nil {
    return
  }

  classSymbols := make(map[*shimast.Symbol]struct{})
  walkDescendants(node, func(child *shimast.Node) {
    name := noClassAssignDeclarationName(child)
    symbol := canonicalValueSymbol(ctx, name)
    if symbol != nil {
      classSymbols[symbol] = struct{}{}
    }
  })
  if len(classSymbols) == 0 {
    return
  }

  reported := make(map[*shimast.Node]struct{})
  walkDescendants(node, func(child *shimast.Node) {
    for _, target := range writeTargetIdentifiers(child) {
      if _, duplicate := reported[target]; duplicate {
        continue
      }
      symbol := canonicalValueSymbol(ctx, target)
      if _, isClass := classSymbols[symbol]; !isClass {
        continue
      }
      reported[target] = struct{}{}
      ctx.Report(target, "'"+identifierText(target)+"' is a class.")
    }
  })
}

// noClassAssignDeclarationName returns the value-binding name introduced by a
// class declaration or named class expression. Anonymous expressions and
// anonymous default-export declarations introduce no writable local name.
func noClassAssignDeclarationName(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindClassDeclaration:
    if declaration := node.AsClassDeclaration(); declaration != nil {
      return declaration.Name()
    }
  case shimast.KindClassExpression:
    if expression := node.AsClassExpression(); expression != nil {
      return expression.Name()
    }
  }
  return nil
}

func init() {
  Register(noClassAssign{})
}
