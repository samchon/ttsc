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
    symbol := noFuncAssignCanonicalSymbol(ctx, name)
    if symbol != nil {
      functionSymbols[symbol] = struct{}{}
    }
  })
  if len(functionSymbols) == 0 {
    return
  }

  reported := make(map[*shimast.Node]struct{})
  walkDescendants(node, func(child *shimast.Node) {
    for _, target := range noFuncAssignWriteTargets(child) {
      if _, duplicate := reported[target]; duplicate {
        continue
      }
      symbol := noFuncAssignCanonicalSymbol(ctx, target)
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

// noFuncAssignWriteTargets returns every identifier written by one official
// reference-writing form. Walking all nodes can encounter a destructuring
// default both as part of its outer pattern and as a nested binary expression;
// the caller deduplicates the shared identifier node before reporting it.
func noFuncAssignWriteTargets(node *shimast.Node) []*shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindBinaryExpression:
    expression := node.AsBinaryExpression()
    if expression != nil && expression.OperatorToken != nil &&
      isAssignmentOperator(expression.OperatorToken.Kind) {
      return assignmentTargetIdentifiers(expression.Left)
    }
  case shimast.KindPrefixUnaryExpression:
    expression := node.AsPrefixUnaryExpression()
    if expression != nil &&
      (expression.Operator == shimast.KindPlusPlusToken || expression.Operator == shimast.KindMinusMinusToken) {
      return assignmentTargetIdentifiers(expression.Operand)
    }
  case shimast.KindPostfixUnaryExpression:
    expression := node.AsPostfixUnaryExpression()
    if expression != nil &&
      (expression.Operator == shimast.KindPlusPlusToken || expression.Operator == shimast.KindMinusMinusToken) {
      return assignmentTargetIdentifiers(expression.Operand)
    }
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    statement := node.AsForInOrOfStatement()
    if statement != nil && statement.Initializer != nil &&
      statement.Initializer.Kind != shimast.KindVariableDeclarationList {
      return assignmentTargetIdentifiers(statement.Initializer)
    }
  }
  return nil
}

// noFuncAssignCanonicalSymbol normalizes merged declarations, including the
// TypeScript function-plus-namespace pattern, to one value-binding identity.
func noFuncAssignCanonicalSymbol(ctx *Context, identifier *shimast.Node) *shimast.Symbol {
  symbol := valueSymbolAtIdentifier(ctx, identifier)
  if symbol == nil {
    return nil
  }
  return ctx.Checker.GetMergedSymbol(symbol)
}

func init() {
  Register(noFuncAssign{})
}
