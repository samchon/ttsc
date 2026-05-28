// unicorn/no-useless-fallback-in-spread: spreading `null` or `undefined`
// into an object literal is already a runtime no-op, so the common
// defensive shape `...(x ?? {})` adds an allocation and a comparison
// that change nothing. The same goes for `...(x || {})` and the
// array-literal variants. Drop the fallback and spread the value
// directly.
//
// AST-only: visit each spread node — `SpreadElement` only when its
// parent is an `ArrayLiteralExpression` (call-argument spread is
// excluded because spreading `null` / `undefined` into a function call
// throws a `TypeError`, so the fallback is load-bearing there) and
// `SpreadAssignment` for object spread. After stripping parentheses,
// the spread's operand must be a binary expression using `??` or `||`
// whose right-hand side is an empty object or array literal. The
// diagnostic anchors on the spread node so editors highlight the
// redundant fallback together with its `...`.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-fallback-in-spread.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUselessFallbackInSpread struct{}

func (unicornNoUselessFallbackInSpread) Name() string {
	return "unicorn/no-useless-fallback-in-spread"
}
func (unicornNoUselessFallbackInSpread) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSpreadElement, shimast.KindSpreadAssignment}
}
func (unicornNoUselessFallbackInSpread) Check(ctx *Context, node *shimast.Node) {
	var operand *shimast.Node
	switch node.Kind {
	case shimast.KindSpreadElement:
		// Only flag array-literal spread. Call-argument spread of a
		// null/undefined operand throws TypeError at runtime, so the
		// `?? []` / `|| []` fallback is load-bearing in that position.
		if node.Parent == nil || node.Parent.Kind != shimast.KindArrayLiteralExpression {
			return
		}
		if spread := node.AsSpreadElement(); spread != nil {
			operand = spread.Expression
		}
	case shimast.KindSpreadAssignment:
		if spread := node.AsSpreadAssignment(); spread != nil {
			operand = spread.Expression
		}
	}
	inner := stripParens(operand)
	if inner == nil || inner.Kind != shimast.KindBinaryExpression {
		return
	}
	bin := inner.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil {
		return
	}
	switch bin.OperatorToken.Kind {
	case shimast.KindQuestionQuestionToken, shimast.KindBarBarToken:
	default:
		return
	}
	right := stripParens(bin.Right)
	if right == nil {
		return
	}
	switch right.Kind {
	case shimast.KindObjectLiteralExpression:
		if obj := right.AsObjectLiteralExpression(); obj != nil &&
			(obj.Properties == nil || len(obj.Properties.Nodes) == 0) {
			ctx.Report(node, "Don't use a useless `?? {}` or `?? []` fallback when spreading — `...null` and `...undefined` are no-ops.")
		}
	case shimast.KindArrayLiteralExpression:
		if arr := right.AsArrayLiteralExpression(); arr != nil &&
			(arr.Elements == nil || len(arr.Elements.Nodes) == 0) {
			ctx.Report(node, "Don't use a useless `?? {}` or `?? []` fallback when spreading — `...null` and `...undefined` are no-ops.")
		}
	}
}

func init() {
	Register(unicornNoUselessFallbackInSpread{})
}
