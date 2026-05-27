// unicorn/prefer-object-from-entries: `entries.reduce((acc, [k, v]) =>
// ({ ...acc, [k]: v }), {})` is the long-hand spelling of
// `Object.fromEntries(entries)`. The reduce shape allocates a fresh
// object at every step (O(n^2) total), reads as the operation rather
// than the intent, and quietly drops to `Object` from whatever type the
// entry shape implied. `Object.fromEntries` does the same thing in one
// pass with one allocation and one well-known name.
//
// AST-only: visit `KindCallExpression`. Fire when the callee is
// `PropertyAccess(_, reduce)` AND the call has exactly two arguments AND
// the second argument is an empty `KindObjectLiteralExpression`. The
// shape of the reducer is intentionally not inspected: an empty-object
// seed in a `.reduce` chain is, in practice, the from-entries shape.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-object-from-entries.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferObjectFromEntries struct{}

func (unicornPreferObjectFromEntries) Name() string {
	return "unicorn/prefer-object-from-entries"
}
func (unicornPreferObjectFromEntries) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferObjectFromEntries) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil {
		return
	}
	if call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Name()) != "reduce" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) != 2 {
		return
	}
	seed := stripParens(call.Arguments.Nodes[1])
	if seed == nil || seed.Kind != shimast.KindObjectLiteralExpression {
		return
	}
	obj := seed.AsObjectLiteralExpression()
	if obj == nil || obj.Properties == nil || len(obj.Properties.Nodes) != 0 {
		return
	}
	ctx.Report(node, "Prefer `Object.fromEntries(...)` over `.reduce((acc, ...) => ..., {})` patterns.")
}

func init() {
	Register(unicornPreferObjectFromEntries{})
}
