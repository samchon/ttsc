// unicorn/prefer-math-trunc: `~~x` and `x | 0` are folk idioms for
// integer truncation that ride on the implicit Int32 coercion of the
// bitwise operators. They lose values outside the int32 range and
// confuse readers expecting a real math function. `Math.trunc(x)`
// expresses the intent directly and handles the full numeric range.
//
// AST-only: visit `KindBinaryExpression` and `KindPrefixUnaryExpression`.
// Fire on:
//
//   - `x | 0` — a BinaryExpression with `|` whose right operand is the
//     numeric literal `0`.
//   - `~~x` — a PrefixUnaryExpression with `~` whose operand is itself
//     a PrefixUnaryExpression with `~` (the parser nests them as
//     `~(~x)`).
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-math-trunc.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferMathTrunc struct{}

func (unicornPreferMathTrunc) Name() string { return "unicorn/prefer-math-trunc" }
func (unicornPreferMathTrunc) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression, shimast.KindPrefixUnaryExpression}
}
func (unicornPreferMathTrunc) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindBinaryExpression:
    expr := node.AsBinaryExpression()
    if expr == nil || expr.OperatorToken == nil ||
      expr.OperatorToken.Kind != shimast.KindBarToken {
      return
    }
    right := stripParens(expr.Right)
    if right == nil || right.Kind != shimast.KindNumericLiteral {
      return
    }
    if numericLiteralText(right) != "0" {
      return
    }
    ctx.Report(node, "Prefer `Math.trunc(x)` over `~~x` / `x | 0` for integer truncation.")
  case shimast.KindPrefixUnaryExpression:
    outer := node.AsPrefixUnaryExpression()
    if outer == nil || outer.Operator != shimast.KindTildeToken || outer.Operand == nil {
      return
    }
    operand := stripParens(outer.Operand)
    if operand == nil || operand.Kind != shimast.KindPrefixUnaryExpression {
      return
    }
    inner := operand.AsPrefixUnaryExpression()
    if inner == nil || inner.Operator != shimast.KindTildeToken {
      return
    }
    ctx.Report(node, "Prefer `Math.trunc(x)` over `~~x` / `x | 0` for integer truncation.")
  }
}

func init() {
  Register(unicornPreferMathTrunc{})
}
