// unicorn/prefer-logical-operator-over-ternary reports `x ? x : y` by
// matching the condition and true branch text. This style baseline does not
// establish stable reads or purity. A logical operator evaluates x once;
// the ternary can evaluate it twice. || preserves the truthiness branch,
// whereas ?? changes the handling of falsy non-nullish values. No edit is
// supplied, so authors must choose the intended evaluation and null policy.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-logical-operator-over-ternary.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferLogicalOperatorOverTernary struct{}

func (unicornPreferLogicalOperatorOverTernary) Name() string {
  return "unicorn/prefer-logical-operator-over-ternary"
}
func (unicornPreferLogicalOperatorOverTernary) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindConditionalExpression}
}
func (unicornPreferLogicalOperatorOverTernary) Check(ctx *Context, node *shimast.Node) {
  cond := node.AsConditionalExpression()
  if cond == nil {
    return
  }
  condExpr := stripParens(cond.Condition)
  whenTrue := stripParens(cond.WhenTrue)
  if condExpr == nil || whenTrue == nil {
    return
  }
  condText := nodeText(ctx.File, condExpr)
  if condText == "" {
    return
  }
  if condText != nodeText(ctx.File, whenTrue) {
    return
  }
  ctx.Report(node, "Consider a logical operator if evaluating the condition once and its truthiness or nullish policy are intended.")
}

func init() {
  Register(unicornPreferLogicalOperatorOverTernary{})
}
