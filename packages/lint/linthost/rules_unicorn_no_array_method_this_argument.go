// unicorn/no-array-method-this-argument: the iteration methods on
// `Array.prototype` accept an optional `thisArg` after the callback. The
// runtime binds that `thisArg` only for non-arrow callbacks — arrow
// callbacks ignore it entirely — so the second argument's behavior
// depends on the callable shape of the first. Replacing it with a closure
// that captures the intended value makes the binding unambiguous and
// arrow-safe.
//
// AST-only: visit each `CallExpression`, match a property-access callee
// whose method identifier is one of the Array.prototype iteration methods
// that accept a thisArg, and fire when the call has exactly two
// arguments. One argument is the canonical no-thisArg shape; three or
// more means a different callsite signature and is out of scope.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-method-this-argument.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornNoArrayMethodThisArgumentMethods = map[string]struct{}{
	"every":         {},
	"filter":        {},
	"find":          {},
	"findIndex":     {},
	"findLast":      {},
	"findLastIndex": {},
	"flatMap":       {},
	"forEach":       {},
	"map":           {},
	"some":          {},
}

type unicornNoArrayMethodThisArgument struct{}

func (unicornNoArrayMethodThisArgument) Name() string {
	return "unicorn/no-array-method-this-argument"
}
func (unicornNoArrayMethodThisArgument) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoArrayMethodThisArgument) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	method := identifierText(access.Name())
	if _, ok := unicornNoArrayMethodThisArgumentMethods[method]; !ok {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) != 2 {
		return
	}
	ctx.Report(node, "Don't use `thisArg` on `Array#"+method+"` — use an explicit closure that captures the value instead.")
}

func init() {
	Register(unicornNoArrayMethodThisArgument{})
}
