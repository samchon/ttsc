// unicorn/no-unnecessary-slice-end: `arr.slice(start, arr.length)` and
// `arr.slice(start, Infinity)` both clamp the end to the array's tail,
// which is exactly what `slice(start)` already does. Removing the
// redundant end argument shortens the call without changing behavior.
//
// AST-only: each visited `CallExpression` checks a `slice` callee with
// exactly two arguments and inspects the second. A `.length` property
// access (on any receiver) or a bare `Infinity` identifier both fire.
// Three or more arguments is out of shape for `Array#slice` and is
// ignored.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-slice-end.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnnecessarySliceEnd struct{}

func (unicornNoUnnecessarySliceEnd) Name() string {
	return "unicorn/no-unnecessary-slice-end"
}
func (unicornNoUnnecessarySliceEnd) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoUnnecessarySliceEnd) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Name()) != "slice" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) != 2 {
		return
	}
	second := stripParens(call.Arguments.Nodes[1])
	if !unicornUnnecessaryCountArgument(second) {
		return
	}
	ctx.Report(call.Arguments.Nodes[1], "Use `slice(start)` without the end — `.length` / `Infinity` is the default.")
}

func init() {
	Register(unicornNoUnnecessarySliceEnd{})
}
