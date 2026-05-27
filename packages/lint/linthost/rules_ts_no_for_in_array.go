// typescript/no-for-in-array: `for (const k in arr)` iterates the
// enumerable property NAMES of `arr` — including inherited members and any
// custom properties someone has attached to `Array.prototype` — and yields
// them as strings, not as numeric indices. The author almost always meant
// `for...of` (values) or a plain index loop (numeric keys). typescript-eslint:
// https://typescript-eslint.io/rules/no-for-in-array/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// noForInArray fires on `for (... in <expr>)` when the Checker reports that
// `<expr>` is an array or tuple type. Type-aware: without a Checker the rule
// cannot tell an array from a plain record-shaped object, so it bails to
// avoid false positives. The constituent-recursion shape mirrors
// `requireArraySortCompareIsArrayLike` — a union like `number[] | string[]`
// is still array-like because every constituent is.
type noForInArray struct{}

func (noForInArray) Name() string { return "typescript/no-for-in-array" }
func (noForInArray) NeedsTypeChecker() bool {
	return true
}
func (noForInArray) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindForInStatement}
}
func (noForInArray) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	stmt := node.AsForInOrOfStatement()
	if stmt == nil || stmt.Expression == nil {
		return
	}
	t := ctx.Checker.GetTypeAtLocation(stmt.Expression)
	if t == nil {
		return
	}
	if !noForInArrayIsArrayLike(ctx.Checker, t) {
		return
	}
	ctx.Report(node, "Iterating an array with `for...in` yields enumerable property names (as strings), including inherited members. Use `for...of`, `forEach`, or an indexed `for` loop instead.")
}

// noForInArrayIsArrayLike reports whether t is provably an array or tuple.
// Mirrors `requireArraySortCompareIsArrayLike`: recurse into union /
// intersection constituents and consider the whole type array-like only when
// every constituent is. `any` / `unknown` / `never` are intentionally NOT
// treated as array-like — they leak from generic helpers and would explode
// the false-positive volume on otherwise legitimate `for...in` over a
// genuinely-keyed object.
func noForInArrayIsArrayLike(checker *shimchecker.Checker, t *shimchecker.Type) bool {
	if checker == nil || t == nil {
		return false
	}
	flags := t.Flags()
	if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
		return false
	}
	if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
		for _, part := range t.Types() {
			if part == nil {
				continue
			}
			if !noForInArrayIsArrayLike(checker, part) {
				return false
			}
		}
		return true
	}
	if shimchecker.Checker_isArrayType(checker, t) {
		return true
	}
	if shimchecker.IsTupleType(t) {
		return true
	}
	return false
}

func init() {
	Register(noForInArray{})
}
