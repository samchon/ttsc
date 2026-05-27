// AST-only baseline of typescript-eslint's `prefer-nullish-coalescing`.
//
// The rule discourages `x || y`, `x ||= y`, and the ternary `x ? x : y`
// pattern when the intent is to substitute a default for `null` /
// `undefined`. `||` short-circuits on every falsy value (0, "", false,
// NaN), so what reads as "default this if missing" silently coerces
// legitimate zeros and empty strings. The ES2020 `??` operator
// short-circuits only on nullish values and is almost always what the
// author meant.
//
// Without the Checker the rule cannot prove `x` actually admits
// `null | undefined`, so the conservative AST-only baseline skips
// operands that the surrounding context already coerces to boolean —
// `if (a || b)`, `!(a || b)`, `cond ? a || b : …`, etc. — and fires on
// the remaining value-producing positions. This mirrors the upstream
// rule's behavior on plain JS where strictNullChecks is off and the
// rule still flags the same shapes.
// https://typescript-eslint.io/rules/prefer-nullish-coalescing/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type preferNullishCoalescing struct{}

func (preferNullishCoalescing) Name() string { return "typescript/prefer-nullish-coalescing" }
func (preferNullishCoalescing) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindBinaryExpression,
		shimast.KindConditionalExpression,
	}
}
func (preferNullishCoalescing) Check(ctx *Context, node *shimast.Node) {
	switch node.Kind {
	case shimast.KindBinaryExpression:
		expr := node.AsBinaryExpression()
		if expr == nil || expr.OperatorToken == nil {
			return
		}
		switch expr.OperatorToken.Kind {
		case shimast.KindBarBarToken:
			if isInBooleanContext(node) {
				return
			}
			reportPreferNullishCoalescing(ctx, expr.OperatorToken, "Prefer `??` over `||` when the intent is to default `null` / `undefined` — `||` also short-circuits on falsy values like 0, \"\", and false.")
		case shimast.KindBarBarEqualsToken:
			reportPreferNullishCoalescing(ctx, expr.OperatorToken, "Prefer `??=` over `||=` when the intent is to default `null` / `undefined` — `||=` also assigns on falsy values like 0, \"\", and false.")
		}
	case shimast.KindConditionalExpression:
		cond := node.AsConditionalExpression()
		if cond == nil || cond.Condition == nil || cond.WhenTrue == nil {
			return
		}
		// `x ? x : y` — the `whenTrue` branch is the same expression as
		// the test. Compare canonical text after stripping parentheses
		// from both sides so `(x) ? x : y` still matches.
		if !ternarySelfTest(ctx, cond) {
			return
		}
		ctx.Report(node, "Prefer `??` over `x ? x : y` when the intent is to default `null` / `undefined` — the ternary form also falls through on falsy values like 0, \"\", and false.")
	}
}

// reportPreferNullishCoalescing pins the diagnostic range to the
// operator token (`||` / `||=`) rather than the whole binary expression
// so the squiggle highlights the offending operator and editor "go to
// fix" actions hover over the token the rule is about.
func reportPreferNullishCoalescing(ctx *Context, operator *shimast.Node, message string) {
	pos, end := tokenRange(ctx.File, operator)
	if pos < 0 {
		ctx.Report(operator, message)
		return
	}
	ctx.ReportRange(pos, end, message)
}

// ternarySelfTest reports whether `cond ? whenTrue : whenFalse` has the
// shape `x ? x : y` — i.e. the truthy branch repeats the condition. The
// comparison uses `nodeText` so parenthesized variants (`(x) ? x : y`)
// and member-access chains (`a.b ? a.b : c`) both match. Side-effecting
// expressions are intentionally not excluded here: the upstream rule
// fires on `f() ? f() : g()` too and lets the author decide whether the
// transform is safe.
func ternarySelfTest(ctx *Context, cond *shimast.ConditionalExpression) bool {
	if ctx == nil || ctx.File == nil || cond == nil {
		return false
	}
	test := stripParens(cond.Condition)
	whenTrue := stripParens(cond.WhenTrue)
	if test == nil || whenTrue == nil {
		return false
	}
	testText := nodeText(ctx.File, test)
	whenTrueText := nodeText(ctx.File, whenTrue)
	if testText == "" || whenTrueText == "" {
		return false
	}
	return testText == whenTrueText
}

func init() {
	Register(preferNullishCoalescing{})
}
