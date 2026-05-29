// unicorn/no-nested-ternary: `a ? b : c ? d : e` packs two decision
// points into one expression and forces the reader to track operator
// precedence to know which branch each value belongs to. Unlike the
// core ESLint rule of the same name, the unicorn variant fires on every
// nested level rather than only the outermost — each inner conditional
// is its own offense and is reported in place.
//
// AST-only: visit every `ConditionalExpression` and report on it when
// its parent is also a `ConditionalExpression`. `stripParens` makes the
// match insensitive to grouping parens.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-nested-ternary.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoNestedTernary struct{}

func (unicornNoNestedTernary) Name() string { return "unicorn/no-nested-ternary" }
func (unicornNoNestedTernary) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindConditionalExpression}
}
func (unicornNoNestedTernary) Check(ctx *Context, node *shimast.Node) {
  cond := node.AsConditionalExpression()
  if cond == nil {
    return
  }
  if hasUnicornNestedConditional(cond.WhenTrue) {
    ctx.Report(stripParens(cond.WhenTrue), "Do not nest ternary expressions.")
    return
  }
  if hasUnicornNestedConditional(cond.WhenFalse) {
    ctx.Report(stripParens(cond.WhenFalse), "Do not nest ternary expressions.")
  }
}

func hasUnicornNestedConditional(node *shimast.Node) bool {
  expr := stripParens(node)
  return expr != nil && expr.Kind == shimast.KindConditionalExpression
}

func init() {
  Register(unicornNoNestedTernary{})
}
