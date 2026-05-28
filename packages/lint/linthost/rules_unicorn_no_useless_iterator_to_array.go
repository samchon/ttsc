// unicorn/no-useless-iterator-to-array: wrapping an iterator-producing
// call in an array-literal spread (`[...arr.entries()]`) materializes
// every element into a throwaway array just to walk through it again.
// The wrappers `.entries()`, `.keys()`, `.values()` already return
// iterables that any iteration consumer can consume directly.
//
// AST-only and conservative: visit each `ArrayLiteralExpression` whose
// only element is a `SpreadElement` wrapping a `CallExpression` whose
// callee is `PropertyAccess(_, name)` with `name ∈ {entries, keys,
// values}`. The array literal must also be in an iterator-consuming
// parent position — currently only `for…of` is matched, since materializing
// an array to iterate it once is the rule's textbook case. Using the
// materialized array as data (`[...iter][0]`, `[...iter].map(…)`,
// `const arr = [...iter]`) is NOT flagged because the author wants the
// array, not a fresh walk.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-iterator-to-array.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUselessIteratorToArray struct{}

func (unicornNoUselessIteratorToArray) Name() string {
	return "unicorn/no-useless-iterator-to-array"
}
func (unicornNoUselessIteratorToArray) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindArrayLiteralExpression}
}
func (unicornNoUselessIteratorToArray) Check(ctx *Context, node *shimast.Node) {
	// Only fire when the array literal is the iterable of a `for…of`
	// loop — that's the canonical wasted-materialization shape. Other
	// uses (`[...iter][0]`, `const arr = [...iter]`, `.map`, etc.)
	// genuinely need the materialized array.
	if node.Parent == nil || node.Parent.Kind != shimast.KindForOfStatement {
		return
	}
	arr := node.AsArrayLiteralExpression()
	if arr == nil || arr.Elements == nil || len(arr.Elements.Nodes) != 1 {
		return
	}
	only := arr.Elements.Nodes[0]
	if only == nil || only.Kind != shimast.KindSpreadElement {
		return
	}
	spread := only.AsSpreadElement()
	if spread == nil {
		return
	}
	inner := stripParens(spread.Expression)
	if inner == nil || inner.Kind != shimast.KindCallExpression {
		return
	}
	call := inner.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	switch identifierText(access.Name()) {
	case "entries", "keys", "values":
	default:
		return
	}
	ctx.Report(node, "Don't wrap an iterator with `[...iter]` when iterating directly works.")
}

func init() {
	Register(unicornNoUselessIteratorToArray{})
}
