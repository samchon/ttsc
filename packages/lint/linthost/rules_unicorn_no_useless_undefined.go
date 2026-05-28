// unicorn/no-useless-undefined: `return undefined;` produces the same
// value as the bare `return;` form, and `void 0` is the canonical
// roundabout spelling of the same constant. Writing the keyword
// explicitly adds noise without changing behavior.
//
// Minimum-viable port: only the `return` statement shape fires. The
// call-argument case is intentionally skipped because matching it
// safely requires knowing which callees accept omission, and the
// parameter-default case (`function f(x = undefined)`) is deferred.
//
// AST-only: visit each `ReturnStatement` whose expression after
// `stripParens` is either the `undefined` keyword/identifier or the
// `void 0` shape (a `VoidExpression` whose operand is the numeric
// literal `0`). Reports on the return statement itself so the
// diagnostic anchors on the keyword rather than the operand.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-undefined.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUselessUndefined struct{}

func (unicornNoUselessUndefined) Name() string { return "unicorn/no-useless-undefined" }
func (unicornNoUselessUndefined) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindReturnStatement}
}
func (unicornNoUselessUndefined) Check(ctx *Context, node *shimast.Node) {
	ret := node.AsReturnStatement()
	if ret == nil || ret.Expression == nil {
		return
	}
	expr := stripParens(ret.Expression)
	if expr == nil {
		return
	}
	if expr.Kind == shimast.KindUndefinedKeyword || identifierText(expr) == "undefined" {
		ctx.Report(node, "Don't `return undefined;` — `return undefined;` and bare `return;` have the same effect.")
		return
	}
	if expr.Kind == shimast.KindVoidExpression {
		void := expr.AsVoidExpression()
		if void == nil || void.Expression == nil {
			return
		}
		operand := stripParens(void.Expression)
		if operand != nil && operand.Kind == shimast.KindNumericLiteral &&
			numericLiteralText(operand) == "0" {
			ctx.Report(node, "Don't `return undefined;` — `return undefined;` and bare `return;` have the same effect.")
		}
	}
}

func init() {
	Register(unicornNoUselessUndefined{})
}
