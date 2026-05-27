// unicorn/no-invalid-remove-event-listener: passing a fresh function
// literal to `removeEventListener` is a no-op because event-target
// internals match listeners by reference identity. The handler that was
// originally registered still fires; the call silently does nothing.
//
// AST-only: visit each `CallExpression`, match when the callee is a
// `PropertyAccessExpression(_, removeEventListener)` and the second
// argument (after stripping parens) is a fresh arrow function or
// function expression. Fire on the call so the diagnostic lands at the
// no-op site.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-invalid-remove-event-listener.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoInvalidRemoveEventListener struct{}

func (unicornNoInvalidRemoveEventListener) Name() string {
	return "unicorn/no-invalid-remove-event-listener"
}
func (unicornNoInvalidRemoveEventListener) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoInvalidRemoveEventListener) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil {
		return
	}
	if call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Name()) != "removeEventListener" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) < 2 {
		return
	}
	handler := stripParens(call.Arguments.Nodes[1])
	if handler == nil {
		return
	}
	switch handler.Kind {
	case shimast.KindArrowFunction, shimast.KindFunctionExpression:
		ctx.Report(node, "Calling `removeEventListener` with a fresh function reference removes nothing — store and reuse the handler.")
	}
}

func init() {
	Register(unicornNoInvalidRemoveEventListener{})
}
