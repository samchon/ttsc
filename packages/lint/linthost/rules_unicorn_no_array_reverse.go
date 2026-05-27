// unicorn/no-array-reverse: `Array#reverse()` mutates the array in place
// and also returns the same reference, which lets aliasing bugs slip into
// otherwise-pure pipelines (`const out = input.reverse()` rewrites
// `input` too). ES2023 ships `Array#toReversed()`, which produces a new
// array and leaves the source untouched, so the rule pushes authors
// toward the non-mutating form.
//
// AST-only: visit each `CallExpression`, check that the callee is a
// property access whose method identifier is `reverse`, and require zero
// arguments — `reverse` accepts none, so a non-empty argument list is
// almost certainly a different `reverse` on a user-defined type and is
// excluded by design.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-reverse.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoArrayReverse struct{}

func (unicornNoArrayReverse) Name() string { return "unicorn/no-array-reverse" }
func (unicornNoArrayReverse) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoArrayReverse) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Name()) != "reverse" {
		return
	}
	if call.Arguments != nil && len(call.Arguments.Nodes) != 0 {
		return
	}
	ctx.Report(node, "Prefer `Array#toReversed()` over the mutating `Array#reverse()`.")
}

func init() {
	Register(unicornNoArrayReverse{})
}
