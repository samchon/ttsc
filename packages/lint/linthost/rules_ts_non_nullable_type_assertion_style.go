// typescript/non-nullable-type-assertion-style: when `x as T` strips
// exactly the `null`/`undefined` constituents from the static type of
// `x`, the assertion is equivalent to the non-null assertion `x!`. The
// `!` form is shorter and communicates "I am asserting non-null"
// explicitly, while `as T` may be read as "I am narrowing to a
// different type". typescript-eslint stylistic-type-checked:
// https://typescript-eslint.io/rules/non-nullable-type-assertion-style/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// nonNullableTypeAssertionStyle reports `expr as T` where `T` equals the
// non-nullable version of `expr`'s static type. Implementation notes:
//
//   - Type-aware: requires the Checker to compute the non-nullable form
//     of the source expression and to compare it against the asserted
//     type. The shim re-exports the unexported `GetNonNullableType` and
//     `GetTypeFromTypeNode` methods directly.
//   - Symmetric assignability is used instead of literal type identity
//     because the Checker may widen literal types differently between
//     the two sides (e.g. the source `string | undefined` becomes
//     `string` after non-null stripping, and the asserted node `string`
//     resolves to the same primitive — both directions of assignability
//     hold and identity is unnecessary).
//   - The rule only fires when the source type was actually nullable;
//     `42 as number` is left alone because removing nothing from
//     `number` still yields `number` and the assertion is not
//     equivalent to `42!` (which would be a syntax error on a literal).
type nonNullableTypeAssertionStyle struct{}

func (nonNullableTypeAssertionStyle) Name() string {
	return "typescript/non-nullable-type-assertion-style"
}
func (nonNullableTypeAssertionStyle) NeedsTypeChecker() bool {
	return true
}
func (nonNullableTypeAssertionStyle) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindAsExpression}
}
func (nonNullableTypeAssertionStyle) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	as := node.AsAsExpression()
	if as == nil || as.Expression == nil || as.Type == nil {
		return
	}
	sourceType := ctx.Checker.GetTypeAtLocation(as.Expression)
	if sourceType == nil {
		return
	}
	// Only consider expressions whose static type actually carries
	// `null` or `undefined`; otherwise `x!` is not the same as `x as T`.
	if !nonNullableTypeAssertionStyleIsNullable(sourceType) {
		return
	}
	nonNullable := ctx.Checker.GetNonNullableType(sourceType)
	if nonNullable == nil {
		return
	}
	assertedType := ctx.Checker.GetTypeFromTypeNode(as.Type)
	if assertedType == nil {
		return
	}
	// Bidirectional assignability stands in for type identity: the
	// stripped source type must coincide with the asserted type up to
	// structural equivalence. Both sides have to hold so that
	// `x as SomeSupertype` or `x as SomeSubtype` does not get rewritten
	// to `x!` and silently lose information.
	if !ctx.Checker.IsTypeAssignableTo(nonNullable, assertedType) {
		return
	}
	if !ctx.Checker.IsTypeAssignableTo(assertedType, nonNullable) {
		return
	}
	ctx.Report(node, "Use a `!` assertion to more succinctly remove `null` and `undefined` from the type.")
}

// nonNullableTypeAssertionStyleIsNullable reports whether t carries
// `null` or `undefined` either at the top level (for direct
// `T | null` / `T | undefined` shapes) or inside a union constituent.
func nonNullableTypeAssertionStyleIsNullable(t *shimchecker.Type) bool {
	if t == nil {
		return false
	}
	flags := t.Flags()
	if flags&(shimchecker.TypeFlagsNull|shimchecker.TypeFlagsUndefined) != 0 {
		return true
	}
	if flags&shimchecker.TypeFlagsUnion != 0 {
		for _, part := range t.Types() {
			if part == nil {
				continue
			}
			if nonNullableTypeAssertionStyleIsNullable(part) {
				return true
			}
		}
	}
	return false
}

func init() {
	Register(nonNullableTypeAssertionStyle{})
}
