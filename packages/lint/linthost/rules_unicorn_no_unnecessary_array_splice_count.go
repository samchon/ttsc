// unicorn/no-unnecessary-array-splice-count: `arr.splice(start, arr.length)`
// and `arr.splice(start, Infinity)` both say "delete from `start` to the
// end", but `splice` already does that when the count argument is
// omitted entirely. Dropping the redundant count makes the intent read
// directly: "splice from `start`."
//
// AST-only: each visited `CallExpression` checks a `splice` /
// `toSpliced` callee with at least two arguments and inspects the
// second. A `.length` property access (on any receiver — the rule
// doesn't try to reconcile receivers) or a bare `Infinity` identifier
// both fire. Anything else is a real count.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-array-splice-count.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnnecessaryArraySpliceCount struct{}

func (unicornNoUnnecessaryArraySpliceCount) Name() string {
	return "unicorn/no-unnecessary-array-splice-count"
}
func (unicornNoUnnecessaryArraySpliceCount) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoUnnecessaryArraySpliceCount) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	method := identifierText(access.Name())
	if method != "splice" && method != "toSpliced" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) < 2 {
		return
	}
	second := stripParens(call.Arguments.Nodes[1])
	if !unicornUnnecessaryCountArgument(second) {
		return
	}
	ctx.Report(call.Arguments.Nodes[1], "Use `splice(start)` without the count — `.length` / `Infinity` is the default.")
}

// unicornUnnecessaryCountArgument reports whether `node` is one of the
// two redundant "until the end" shapes — a `.length` property access on
// any receiver, or the bare `Infinity` identifier.
func unicornUnnecessaryCountArgument(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	if node.Kind == shimast.KindPropertyAccessExpression {
		access := node.AsPropertyAccessExpression()
		if access == nil {
			return false
		}
		return identifierText(access.Name()) == "length"
	}
	if node.Kind == shimast.KindIdentifier {
		return identifierText(node) == "Infinity"
	}
	return false
}

func init() {
	Register(unicornNoUnnecessaryArraySpliceCount{})
}
