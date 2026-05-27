// typescript/no-unnecessary-boolean-literal-compare: comparing a value
// already typed as `boolean` against `true` / `false` adds noise without
// changing the result — `x === true` evaluates to `x`, `x === false`
// evaluates to `!x`. The rule narrows to direct comparisons because once
// the operand carries `null` / `undefined` the literal compare actually
// strips nullability and is no longer redundant. typescript-eslint:
// https://typescript-eslint.io/rules/no-unnecessary-boolean-literal-compare/
//
// Type-aware. Without a Checker we cannot prove the non-literal side is
// pure boolean, so Context.Checker == nil short-circuits the rule the
// same way `no-misused-promises` and `strict-boolean-expressions` do.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noUnnecessaryBooleanLiteralCompare struct{}

func (noUnnecessaryBooleanLiteralCompare) Name() string {
	return "typescript/no-unnecessary-boolean-literal-compare"
}
func (noUnnecessaryBooleanLiteralCompare) NeedsTypeChecker() bool {
	return true
}
func (noUnnecessaryBooleanLiteralCompare) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (noUnnecessaryBooleanLiteralCompare) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	bin := node.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil || bin.Left == nil || bin.Right == nil {
		return
	}
	// Only equality / inequality operators are subject to the rewrite —
	// `<`, `>`, `&&`, etc. against `true` / `false` are not the same shape.
	switch bin.OperatorToken.Kind {
	case shimast.KindEqualsEqualsToken,
		shimast.KindEqualsEqualsEqualsToken,
		shimast.KindExclamationEqualsToken,
		shimast.KindExclamationEqualsEqualsToken:
	default:
		return
	}
	left := stripParens(bin.Left)
	right := stripParens(bin.Right)
	if left == nil || right == nil {
		return
	}
	// Identify which side is the literal and which side is the value.
	// `true === x` and `x === true` are both reported.
	var value *shimast.Node
	switch {
	case noUnnecessaryBooleanLiteralCompareIsBoolLiteral(left):
		value = right
	case noUnnecessaryBooleanLiteralCompareIsBoolLiteral(right):
		value = left
	default:
		return
	}
	// Skip when both sides are literals — that's a different code smell
	// (e.g. `true === false`) that other rules cover.
	if noUnnecessaryBooleanLiteralCompareIsBoolLiteral(value) {
		return
	}
	t := ctx.Checker.GetTypeAtLocation(value)
	if t == nil {
		return
	}
	// Only fire when the value side is pure boolean. A `boolean | null`
	// operand uses the literal compare to strip nullability — leaving
	// that intact is the explicit carve-out the rule documentation calls
	// out, so we refuse to flag it.
	if !noUnnecessaryBooleanLiteralCompareIsPureBoolean(t) {
		return
	}
	ctx.Report(node, "This comparison against a boolean literal is unnecessary; use the value (or its negation) directly.")
}

// noUnnecessaryBooleanLiteralCompareIsBoolLiteral reports whether node is
// the literal `true` or `false` keyword.
func noUnnecessaryBooleanLiteralCompareIsBoolLiteral(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	return node.Kind == shimast.KindTrueKeyword || node.Kind == shimast.KindFalseKeyword
}

// noUnnecessaryBooleanLiteralCompareIsPureBoolean reports whether t is a
// pure boolean type — `boolean`, `true`, `false`, or a union strictly of
// these. `boolean | null`, `boolean | undefined`, and `any` / `unknown`
// are explicitly excluded so the literal compare stays in place when it
// is also stripping nullability or escaping an opaque value.
func noUnnecessaryBooleanLiteralCompareIsPureBoolean(t *shimchecker.Type) bool {
	if t == nil {
		return false
	}
	flags := t.Flags()
	if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
		return false
	}
	if flags&shimchecker.TypeFlagsUnion != 0 {
		parts := t.Types()
		if len(parts) == 0 {
			return false
		}
		for _, part := range parts {
			if part == nil {
				return false
			}
			pf := part.Flags()
			if pf&(shimchecker.TypeFlagsNull|shimchecker.TypeFlagsUndefined) != 0 {
				return false
			}
			if pf&shimchecker.TypeFlagsBooleanLike == 0 {
				return false
			}
		}
		return true
	}
	return flags&shimchecker.TypeFlagsBooleanLike != 0
}

func init() {
	Register(noUnnecessaryBooleanLiteralCompare{})
}
