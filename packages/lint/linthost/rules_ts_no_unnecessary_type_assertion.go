// typescript/no-unnecessary-type-assertion: `x as T`, `<T>x`, and `x!`
// add nothing when the static type of `x` already equals `T` (or is
// already non-nullable, for the `!` form). typescript-eslint
// recommended-type-checked:
// https://typescript-eslint.io/rules/no-unnecessary-type-assertion/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// noUnnecessaryTypeAssertion reports redundant `as`, type-prefix, and
// non-null assertions. Implementation notes:
//
//   - Type-aware: requires the Checker so the source expression's static
//     type can be compared against the asserted target. The shim
//     re-exports the unexported `GetTypeFromTypeNode` and
//     `IsTypeAssignableTo` methods directly, the same plumbing that the
//     sibling `non-nullable-type-assertion-style` rule uses.
//   - Symmetric assignability is used in place of literal type identity
//     for the same reason as `non-nullable-type-assertion-style`: the
//     Checker may widen literal types on one side and not the other
//     (e.g. `"foo" as string` versus the literal `"foo"`), so requiring
//     both directions of assignability stands in for structural
//     equivalence without over-firing on widening.
//   - The `as const` form is intentionally skipped because it produces
//     a strictly narrower type than the source expression; `as const`
//     assertions on already-literal expressions are handled by the
//     companion `typescript/prefer-as-const` rule.
//   - For `x!` (NonNullExpression) the rule fires when the inner
//     expression's static type has no `null` or `undefined`
//     constituent — the `!` strips nothing.
type noUnnecessaryTypeAssertion struct{}

func (noUnnecessaryTypeAssertion) Name() string {
	return "typescript/no-unnecessary-type-assertion"
}
func (noUnnecessaryTypeAssertion) NeedsTypeChecker() bool {
	return true
}
func (noUnnecessaryTypeAssertion) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindAsExpression,
		shimast.KindTypeAssertionExpression,
		shimast.KindNonNullExpression,
	}
}
func (noUnnecessaryTypeAssertion) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	switch node.Kind {
	case shimast.KindAsExpression:
		as := node.AsAsExpression()
		if as == nil || as.Expression == nil || as.Type == nil {
			return
		}
		if isConstTypeReference(as.Type) {
			return
		}
		noUnnecessaryTypeAssertionCheckAssertion(ctx, node, as.Expression, as.Type)
	case shimast.KindTypeAssertionExpression:
		ta := node.AsTypeAssertion()
		if ta == nil || ta.Expression == nil || ta.Type == nil {
			return
		}
		if isConstTypeReference(ta.Type) {
			return
		}
		noUnnecessaryTypeAssertionCheckAssertion(ctx, node, ta.Expression, ta.Type)
	case shimast.KindNonNullExpression:
		nn := node.AsNonNullExpression()
		if nn == nil || nn.Expression == nil {
			return
		}
		sourceType := ctx.Checker.GetTypeAtLocation(nn.Expression)
		if sourceType == nil {
			return
		}
		if noUnnecessaryTypeAssertionIsNullable(sourceType) {
			return
		}
		ctx.Report(node, "This assertion is unnecessary since it does not change the type of the expression.")
	}
}

// noUnnecessaryTypeAssertionCheckAssertion runs the shared logic for
// `expr as T` and `<T>expr`: report when the asserted type and source
// type are mutually assignable.
func noUnnecessaryTypeAssertionCheckAssertion(ctx *Context, node, expr, typeNode *shimast.Node) {
	sourceType := ctx.Checker.GetTypeAtLocation(expr)
	if sourceType == nil {
		return
	}
	assertedType := ctx.Checker.GetTypeFromTypeNode(typeNode)
	if assertedType == nil {
		return
	}
	// Bidirectional assignability stands in for type identity: see the
	// note on `non-nullable-type-assertion-style`. The assertion is
	// redundant only when both sides describe the same set of values.
	if !ctx.Checker.IsTypeAssignableTo(sourceType, assertedType) {
		return
	}
	if !ctx.Checker.IsTypeAssignableTo(assertedType, sourceType) {
		return
	}
	ctx.Report(node, "This assertion is unnecessary since it does not change the type of the expression.")
}

// isConstTypeReference reports whether the type node is the bare
// identifier `const`, i.e. the `as const` syntax. The TypeScript parser
// represents `as const` as an AsExpression / TypeAssertion whose type
// node is a TypeReference to the identifier `const` rather than a real
// type — every other rule that touches assertion nodes needs to skip
// it because it is structurally an assertion but semantically a const
// context request.
func isConstTypeReference(typeNode *shimast.Node) bool {
	if typeNode == nil || typeNode.Kind != shimast.KindTypeReference {
		return false
	}
	ref := typeNode.AsTypeReferenceNode()
	if ref == nil {
		return false
	}
	return identifierText(ref.TypeName) == "const"
}

// noUnnecessaryTypeAssertionIsNullable reports whether t carries `null`
// or `undefined` at the top level or inside a union constituent. The
// shape mirrors `nonNullableTypeAssertionStyleIsNullable` because both
// rules answer the same question about the source expression.
func noUnnecessaryTypeAssertionIsNullable(t *shimchecker.Type) bool {
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
			if noUnnecessaryTypeAssertionIsNullable(part) {
				return true
			}
		}
	}
	return false
}

func init() {
	Register(noUnnecessaryTypeAssertion{})
}
