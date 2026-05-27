// unicorn/no-array-for-each: `Array#forEach` is harder to short-circuit and
// to reason about than a `for…of` loop — `break`/`continue`/`return` from
// the loop body all become per-iteration callback returns with different
// semantics, and async/await inside the callback silently no-ops because
// the iteration callback is not awaited.
//
// AST-only: dispatch on each `CallExpression`, look for a property-access
// callee whose method identifier is `forEach`, and fire on the call. The
// receiver expression is not type-checked — the syntactic shape is the
// signal the rule wants to discourage, regardless of whether the value is
// known to be an array at the type level.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-for-each.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoArrayForEach struct{}

func (unicornNoArrayForEach) Name() string { return "unicorn/no-array-for-each" }
func (unicornNoArrayForEach) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoArrayForEach) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Name()) != "forEach" {
		return
	}
	ctx.Report(node, "Use `for…of` instead of `.forEach(…)`.")
}

func init() {
	Register(unicornNoArrayForEach{})
}
