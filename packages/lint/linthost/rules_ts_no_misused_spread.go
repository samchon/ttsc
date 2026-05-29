// AST-only subset of the upstream `typescript/no-misused-spread` rule.
//
// The full upstream rule needs the type checker to decide whether the
// spread operand is actually iterable (or a plain object). This subset
// catches the three syntactic shapes that are unambiguously wrong even
// without type information:
//
//  1. Object literal spread inside an array literal — `[...{ a: 1 }]`.
//     Object literals are not iterable, so this is always a TypeError
//     at runtime.
//  2. Object literal spread as a call/construct argument —
//     `f(...{ a: 1 })`, `new Set(...{ a: 1 })`. Same reason: the
//     callee receives the spread via iteration.
//  3. Array literal spread inside an object literal — `{ ...[1, 2] }`.
//     The array's numeric indices become string keys (`"0"`, `"1"`,
//     …) which is almost never what the author intended.
//
// https://typescript-eslint.io/rules/no-misused-spread/
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noMisusedSpread struct{}

func (noMisusedSpread) Name() string { return "typescript/no-misused-spread" }
func (noMisusedSpread) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindArrayLiteralExpression,
    shimast.KindObjectLiteralExpression,
    shimast.KindCallExpression,
    shimast.KindNewExpression,
  }
}
func (noMisusedSpread) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindArrayLiteralExpression:
    arr := node.AsArrayLiteralExpression()
    if arr == nil || arr.Elements == nil {
      return
    }
    for _, elem := range arr.Elements.Nodes {
      reportObjectSpreadInIterable(ctx, elem)
    }
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil || call.Arguments == nil {
      return
    }
    for _, arg := range call.Arguments.Nodes {
      reportObjectSpreadInIterable(ctx, arg)
    }
  case shimast.KindNewExpression:
    ne := node.AsNewExpression()
    if ne == nil || ne.Arguments == nil {
      return
    }
    for _, arg := range ne.Arguments.Nodes {
      reportObjectSpreadInIterable(ctx, arg)
    }
  case shimast.KindObjectLiteralExpression:
    obj := node.AsObjectLiteralExpression()
    if obj == nil || obj.Properties == nil {
      return
    }
    for _, prop := range obj.Properties.Nodes {
      if prop == nil || prop.Kind != shimast.KindSpreadAssignment {
        continue
      }
      spread := prop.AsSpreadAssignment()
      if spread == nil {
        continue
      }
      inner := stripParens(spread.Expression)
      if inner != nil && inner.Kind == shimast.KindArrayLiteralExpression {
        ctx.Report(prop, "Spreading an array literal into an object literal coerces numeric indices to string keys — likely a mistake.")
      }
    }
  }
}

// reportObjectSpreadInIterable reports the spread element when its
// operand is an object literal in a position that consumes the spread
// via iteration (array literal element or function/constructor
// argument).
func reportObjectSpreadInIterable(ctx *Context, elem *shimast.Node) {
  if elem == nil || elem.Kind != shimast.KindSpreadElement {
    return
  }
  spread := elem.AsSpreadElement()
  if spread == nil {
    return
  }
  inner := stripParens(spread.Expression)
  if inner == nil || inner.Kind != shimast.KindObjectLiteralExpression {
    return
  }
  ctx.Report(elem, "Spread of an object literal into an iterable context is meaningless — object literals are not iterable.")
}

func init() {
  Register(noMisusedSpread{})
}
