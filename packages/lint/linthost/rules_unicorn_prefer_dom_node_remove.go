// unicorn/prefer-dom-node-remove: `parent.removeChild(child)` requires
// the caller to thread the parent through to detach a node — `child.remove()`
// is the supported modern shape and avoids the dangling-reference class
// of bugs where the wrong parent is consulted.
//
// AST-only: visit each `CallExpression`, match a property-access callee
// whose method identifier is `removeChild`, and fire when the call has
// exactly one argument. The single-argument gate isolates the canonical
// detach shape from custom `removeChild` overloads that take more.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dom-node-remove.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferDomNodeRemove struct{}

func (unicornPreferDomNodeRemove) Name() string { return "unicorn/prefer-dom-node-remove" }
func (unicornPreferDomNodeRemove) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferDomNodeRemove) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Name()) != "removeChild" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
		return
	}
	ctx.Report(node, "Prefer `ChildNode#remove()` over `parentNode.removeChild(child)`.")
}

func init() {
	Register(unicornPreferDomNodeRemove{})
}
