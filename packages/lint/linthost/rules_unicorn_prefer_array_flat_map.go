// unicorn/prefer-array-flat-map: the pair `someArr.map(fn).flat()` walks
// the source array twice — once to map and once to flatten — when a
// single `flatMap` call would do both in one pass. The rule flags the
// chained shape so authors collapse it to the built-in.
//
// AST-only: a `CallExpression` whose callee is `.flat` AND whose
// receiver is itself a `CallExpression` whose callee is `.map` matches.
// The `.flat(...)` call must be argument-less or explicitly `.flat(1)`
// — `.map(fn).flat(2)` is NOT equivalent to `.flatMap(fn)` because the
// latter only flattens one level. The diagnostic anchors on the outer
// call so editors highlight the whole `.map(...).flat(...)` chain.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-flat-map.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferArrayFlatMap struct{}

func (unicornPreferArrayFlatMap) Name() string { return "unicorn/prefer-array-flat-map" }
func (unicornPreferArrayFlatMap) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferArrayFlatMap) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	outerAccess := call.Expression.AsPropertyAccessExpression()
	if outerAccess == nil || identifierText(outerAccess.Name()) != "flat" {
		return
	}
	// `.flat(2)` and deeper are NOT equivalent to `.flatMap` — only the
	// default depth (no arg) or explicit depth 1 collapse cleanly.
	if call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
		if len(call.Arguments.Nodes) != 1 {
			return
		}
		arg := stripParens(call.Arguments.Nodes[0])
		if arg == nil || arg.Kind != shimast.KindNumericLiteral ||
			numericLiteralText(arg) != "1" {
			return
		}
	}
	receiver := stripParens(outerAccess.Expression)
	if receiver == nil || receiver.Kind != shimast.KindCallExpression {
		return
	}
	innerCall := receiver.AsCallExpression()
	if innerCall == nil || innerCall.Expression == nil ||
		innerCall.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	innerAccess := innerCall.Expression.AsPropertyAccessExpression()
	if innerAccess == nil || identifierText(innerAccess.Name()) != "map" {
		return
	}
	ctx.Report(node, "Prefer `Array#flatMap` over `Array#map().flat()`.")
}

func init() {
	Register(unicornPreferArrayFlatMap{})
}
