// noConfusingVoidExpression reports `void X` operator uses placed in
// positions where the surrounding context expects a value. The `void`
// operator always evaluates to `undefined`, so threading it through a
// binary expression, ternary, call argument, initializer, or `return`
// statement is almost always a confusion between the operator and the
// `void` type.
//
// Allowed positions:
//   - statement: `void x;`
//   - arrow function concise body: `() => void x`
//   - operand of an enclosing `void`: `void void x` — only the outer
//     `void` is checked; the inner one is acceptable as the `void`
//     operand of another `void`.
//
// This rule is AST-only — it does not consult the Checker for the
// surrounding function's return type, so `return void X` from a
// `void`-returning function is still reported. This matches the
// behavior the upstream rule produces with its
// `ignoreVoidReturningFunctions: false` default.
//
// https://typescript-eslint.io/rules/no-confusing-void-expression/
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noConfusingVoidExpression struct{}

func (noConfusingVoidExpression) Name() string {
  return "typescript/no-confusing-void-expression"
}
func (noConfusingVoidExpression) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVoidExpression}
}
func (noConfusingVoidExpression) Check(ctx *Context, node *shimast.Node) {
  if isValidVoidExpressionPosition(node) {
    return
  }
  ctx.Report(node, "Placing `void` operator in a value position is confusing — use it only as a statement, an arrow concise body, or inside another `void`.")
}

// isValidVoidExpressionPosition reports whether the `void X`
// expression at `node` sits in one of the three permitted positions.
// Parenthesized expressions are transparent — `(void x)` keeps the
// same effective context as `void x` for the surrounding code.
func isValidVoidExpressionPosition(node *shimast.Node) bool {
  parent := node.Parent
  for parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
    node = parent
    parent = parent.Parent
  }
  if parent == nil {
    return false
  }
  switch parent.Kind {
  case shimast.KindExpressionStatement:
    return true
  case shimast.KindVoidExpression:
    // `void void x` — the inner `void` is the operand of another
    // `void`, which discards the result anyway.
    return true
  case shimast.KindArrowFunction:
    arrow := parent.AsArrowFunction()
    return arrow != nil && arrow.Body == node
  }
  return false
}

func init() {
  Register(noConfusingVoidExpression{})
}
