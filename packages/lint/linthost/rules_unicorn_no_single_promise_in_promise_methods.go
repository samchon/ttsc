// unicorn/no-single-promise-in-promise-methods:
// `Promise.all([single])`, `Promise.allSettled([single])`,
// `Promise.race([single])`, and `Promise.any([single])` are redundant
// wrappers — the result is just `single` (or a one-element array
// wrapping its resolution, which the caller can produce trivially).
// The wrapper hides the fact that there is only one promise in flight
// and forces an extra allocation for no behavioral difference.
//
// AST-only and identifier-text-driven: dispatch on `CallExpression`,
// match a `Promise.<method>` callee against the four collection
// methods, and require exactly one argument whose stripped form is an
// `ArrayLiteralExpression` with exactly one element. Shadowed
// `Promise` bindings are out of scope; the syntactic shape is the
// signal.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-single-promise-in-promise-methods.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoSinglePromiseInPromiseMethods struct{}

func (unicornNoSinglePromiseInPromiseMethods) Name() string {
	return "unicorn/no-single-promise-in-promise-methods"
}
func (unicornNoSinglePromiseInPromiseMethods) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoSinglePromiseInPromiseMethods) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Expression) != "Promise" {
		return
	}
	switch identifierText(access.Name()) {
	case "all", "allSettled", "race", "any":
	default:
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
		return
	}
	arg := stripParens(call.Arguments.Nodes[0])
	if arg == nil || arg.Kind != shimast.KindArrayLiteralExpression {
		return
	}
	arr := arg.AsArrayLiteralExpression()
	if arr == nil || arr.Elements == nil || len(arr.Elements.Nodes) != 1 {
		return
	}
	ctx.Report(node, "Don't wrap a single promise in `Promise.<method>([...])` — the wrapper is redundant.")
}

func init() {
	Register(unicornNoSinglePromiseInPromiseMethods{})
}
