// unicorn/prefer-logical-operator-over-ternary: `x ? x : y` evaluates `x`
// twice and adds a branch only to reproduce what `x || y` (for truthy
// preservation) or `x ?? y` (for nullish-only) already say in one
// shorter, allocation-free token. The ternary spelling tends to crop up
// when authors forget the short-circuit operators exist; the rule nudges
// them back to the canonical form.
//
// AST-only: visit `KindConditionalExpression`. Fire when the textual form
// of `cond` (after `stripParens`) equals the textual form of `whenTrue`.
// That covers the `cond ? cond : alt` shape. The negated `!x ? y : x`
// case is left to a future iteration to keep the rule focused on a
// single shape.
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
	ctx.Report(node, "Prefer `a || b` / `a ?? b` over the equivalent ternary `a ? a : b`.")
}

func init() {
	Register(unicornPreferLogicalOperatorOverTernary{})
}
