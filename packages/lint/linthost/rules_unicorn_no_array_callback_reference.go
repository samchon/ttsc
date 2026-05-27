// unicorn/no-array-callback-reference: passing a function reference
// directly to an `Array#…` iteration method silently exposes it to
// extra positional arguments. `[1,2,3].filter(isEven)` passes `isEven`
// the index and the source array as well as the element, which is fine
// for `isEven` but breaks the moment the predicate's signature grows
// optional parameters. Wrapping in an arrow that takes just the value
// pins the call shape locally.
//
// AST-only: each visited `CallExpression` is matched against a
// property-access callee whose method name is one of the iteration
// methods, and the first argument is checked for the bare-identifier
// shape. Anything more elaborate (member access, arrow, call result)
// has already named the call shape explicitly and is out of scope.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-callback-reference.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornNoArrayCallbackReferenceMethods = map[string]struct{}{
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

type unicornNoArrayCallbackReference struct{}

func (unicornNoArrayCallbackReference) Name() string {
	return "unicorn/no-array-callback-reference"
}
func (unicornNoArrayCallbackReference) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoArrayCallbackReference) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	method := identifierText(access.Name())
	if _, ok := unicornNoArrayCallbackReferenceMethods[method]; !ok {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
		return
	}
	first := call.Arguments.Nodes[0]
	if first == nil || first.Kind != shimast.KindIdentifier {
		return
	}
	ctx.Report(first, "Don't pass a function reference directly to `Array#"+method+"` — wrap it in an arrow that takes only the value.")
}

func init() {
	Register(unicornNoArrayCallbackReference{})
}
