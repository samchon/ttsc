// strictBooleanExpressions fires when a non-boolean value is used in
// a boolean context — the test of an `if` / `while` / `do` / `for` /
// ternary, the operand of `!`, or either side of `&&` / `||`.
// JavaScript coerces every truthy / falsy shape silently:
//
//   - numbers: `0`, `-0`, and `NaN` are falsy; every other number is
//     truthy. `if (count)` therefore skips a legitimate zero.
//   - strings: `""` is falsy; every other string is truthy.
//     `if (name)` therefore skips a legitimate empty string.
//   - nullable objects: `null` / `undefined` are falsy, the object is
//     truthy. `if (obj)` collapses the present-vs-absent and
//     present-but-empty cases together.
//
// The fix is always an explicit comparison naming the intent —
// `count !== 0`, `str.length > 0`, `obj != null`. typescript-eslint:
// https://typescript-eslint.io/rules/strict-boolean-expressions/
//
// Type-aware. Without a Checker the rule cannot tell a `boolean` apart
// from a `string`, so Context.Checker == nil short-circuits each Check
// to a no-op the way `no-for-in-array` and `no-misused-promises` do.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type strictBooleanExpressions struct{}

func (strictBooleanExpressions) Name() string { return "typescript/strict-boolean-expressions" }
func (strictBooleanExpressions) NeedsTypeChecker() bool {
	return true
}
func (strictBooleanExpressions) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindIfStatement,
		shimast.KindWhileStatement,
		shimast.KindDoStatement,
		shimast.KindForStatement,
		shimast.KindConditionalExpression,
		shimast.KindPrefixUnaryExpression,
		shimast.KindBinaryExpression,
	}
}
func (strictBooleanExpressions) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	switch node.Kind {
	case shimast.KindIfStatement:
		if stmt := node.AsIfStatement(); stmt != nil {
			strictBooleanExpressionsReport(ctx, stmt.Expression)
		}
	case shimast.KindWhileStatement:
		if stmt := node.AsWhileStatement(); stmt != nil {
			strictBooleanExpressionsReport(ctx, stmt.Expression)
		}
	case shimast.KindDoStatement:
		if stmt := node.AsDoStatement(); stmt != nil {
			strictBooleanExpressionsReport(ctx, stmt.Expression)
		}
	case shimast.KindForStatement:
		if stmt := node.AsForStatement(); stmt != nil {
			strictBooleanExpressionsReport(ctx, stmt.Condition)
		}
	case shimast.KindConditionalExpression:
		if expr := node.AsConditionalExpression(); expr != nil {
			strictBooleanExpressionsReport(ctx, expr.Condition)
		}
	case shimast.KindPrefixUnaryExpression:
		expr := node.AsPrefixUnaryExpression()
		if expr != nil && expr.Operator == shimast.KindExclamationToken {
			strictBooleanExpressionsReport(ctx, expr.Operand)
		}
	case shimast.KindBinaryExpression:
		bin := node.AsBinaryExpression()
		if bin == nil || bin.OperatorToken == nil {
			return
		}
		// Only `&&` / `||` test their left operand for truthiness.
		// `??` short-circuits on nullish, not on falsy, so a non-boolean
		// left operand is exactly the point of `??` and is not flagged.
		switch bin.OperatorToken.Kind {
		case shimast.KindAmpersandAmpersandToken, shimast.KindBarBarToken:
			strictBooleanExpressionsReport(ctx, bin.Left)
		}
	}
}

// strictBooleanExpressionsReport flags `expr` when its static type is
// not pure boolean-like. The recursion arm peels through `&&` / `||`
// chains so `if (a && b)` reports both `a` and `b`, mirroring the
// upstream rule. Parenthesized wrappers are skipped via stripParens
// so `if ((x))` resolves to `x`.
func strictBooleanExpressionsReport(ctx *Context, expr *shimast.Node) {
	if expr == nil {
		return
	}
	expr = stripParens(expr)
	if expr == nil {
		return
	}
	// Descend through `&&` / `||` — each conjunct/disjunct sits in
	// boolean position too. The outer BinaryExpression visit only
	// checks Left; the descent here finds Right as well.
	if expr.Kind == shimast.KindBinaryExpression {
		bin := expr.AsBinaryExpression()
		if bin != nil && bin.OperatorToken != nil {
			switch bin.OperatorToken.Kind {
			case shimast.KindAmpersandAmpersandToken, shimast.KindBarBarToken:
				strictBooleanExpressionsReport(ctx, bin.Left)
				strictBooleanExpressionsReport(ctx, bin.Right)
				return
			}
		}
	}
	t := ctx.Checker.GetTypeAtLocation(expr)
	if t == nil {
		return
	}
	if strictBooleanExpressionsIsBoolean(t) {
		return
	}
	ctx.Report(expr, "Unexpected non-boolean value in a boolean conditional position. Use an explicit comparison (`!== 0`, `.length > 0`, `!= null`) to name the intent.")
}

// strictBooleanExpressionsIsBoolean reports whether t is pure
// boolean-like. `any` / `unknown` / `never` are intentionally NOT
// considered boolean — they leak through generic helpers and would
// suppress the rule everywhere a value of unknown origin lands in a
// conditional. Union and intersection types must have every
// constituent boolean for the whole type to count.
func strictBooleanExpressionsIsBoolean(t *shimchecker.Type) bool {
	if t == nil {
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
			if !strictBooleanExpressionsIsBoolean(part) {
				return false
			}
		}
		return true
	}
	return flags&shimchecker.TypeFlagsBooleanLike != 0
}

func init() {
	Register(strictBooleanExpressions{})
}
