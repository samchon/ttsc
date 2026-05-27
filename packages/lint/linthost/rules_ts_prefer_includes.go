// typescript/prefer-includes: prefer `array.includes(x)` over the
// `array.indexOf(x) !== -1` (and the related `=== -1`, `>= 0`, `< 0`,
// `> -1`) idioms. The `includes` form states the intent directly —
// "does the collection contain this value?" — and avoids the
// sentinel-vs-position confusion that comes with comparing an
// `indexOf` return value against `-1`. typescript-eslint:
// https://typescript-eslint.io/rules/prefer-includes/
//
// Type-aware. Without a Checker the rule cannot prove the receiver of
// `indexOf` is array-like or string-like, so Context.Checker == nil
// short-circuits each Check to a no-op the way `no-for-in-array` and
// `require-array-sort-compare` do. The receiver type must be a
// provable array, tuple, or string — generic, `any`, `unknown`, and
// `never` pass through so generic helpers don't explode with false
// positives.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type preferIncludes struct{}

func (preferIncludes) Name() string { return "typescript/prefer-includes" }
func (preferIncludes) NeedsTypeChecker() bool {
	return true
}
func (preferIncludes) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (preferIncludes) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	bin := node.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil {
		return
	}
	// One side of the comparison must be a `.indexOf(...)` call; the
	// other side must be a numeric sentinel (-1 or 0) and the operator
	// chosen so the boolean meaning is "is the value present".
	if !preferIncludesIsTargetedComparison(bin.OperatorToken.Kind) {
		return
	}
	if preferIncludesCheckSide(ctx, bin.Left, bin.Right, bin.OperatorToken.Kind, false) {
		ctx.Report(node, preferIncludesMessage)
		return
	}
	if preferIncludesCheckSide(ctx, bin.Right, bin.Left, bin.OperatorToken.Kind, true) {
		ctx.Report(node, preferIncludesMessage)
	}
}

const preferIncludesMessage = "Prefer `.includes(x)` over `.indexOf(x)` compared against `-1` / `0` — `.includes` states the containment intent directly."

// preferIncludesIsTargetedComparison reports whether the operator is
// one of the equality / ordering tokens the rule cares about. The
// rule fires on `===`, `!==`, `==`, `!=`, `<`, `<=`, `>`, `>=`; other
// operators leave the binary alone.
func preferIncludesIsTargetedComparison(kind shimast.Kind) bool {
	switch kind {
	case shimast.KindEqualsEqualsToken,
		shimast.KindEqualsEqualsEqualsToken,
		shimast.KindExclamationEqualsToken,
		shimast.KindExclamationEqualsEqualsToken,
		shimast.KindLessThanToken,
		shimast.KindLessThanEqualsToken,
		shimast.KindGreaterThanToken,
		shimast.KindGreaterThanEqualsToken:
		return true
	}
	return false
}

// preferIncludesCheckSide reports whether `call` is the
// `<receiver>.indexOf(arg)` call and `sentinel` is the numeric
// constant the comparison is paired with. `reversed` flips the
// direction of ordering operators so `arr.indexOf(x) > -1` and
// `-1 < arr.indexOf(x)` both match.
func preferIncludesCheckSide(
	ctx *Context,
	call, sentinel *shimast.Node,
	op shimast.Kind,
	reversed bool,
) bool {
	call = stripParens(call)
	sentinel = stripParens(sentinel)
	if call == nil || sentinel == nil {
		return false
	}
	if call.Kind != shimast.KindCallExpression {
		return false
	}
	callExpr := call.AsCallExpression()
	if callExpr == nil || callExpr.Expression == nil {
		return false
	}
	receiver, method, ok := promisePropertyAccessParts(callExpr.Expression)
	if !ok || method != "indexOf" {
		return false
	}
	if callExpr.Arguments == nil || len(callExpr.Arguments.Nodes) != 1 {
		return false
	}
	value, ok := preferIncludesSentinelValue(sentinel)
	if !ok {
		return false
	}
	effectiveOp := op
	if reversed {
		effectiveOp = preferIncludesFlipOperator(op)
	}
	if !preferIncludesIsPresenceComparison(effectiveOp, value) {
		return false
	}
	if receiver == nil {
		return false
	}
	t := ctx.Checker.GetTypeAtLocation(receiver)
	if t == nil {
		return false
	}
	return preferIncludesIsArrayOrString(ctx.Checker, t)
}

// preferIncludesSentinelValue returns the numeric sentinel encoded by
// `node`, recognizing the literals `-1`, `0`, and `1` (the only
// constants the rule's shapes reduce to). Returns ok=false for any
// other expression.
func preferIncludesSentinelValue(node *shimast.Node) (int, bool) {
	if node == nil {
		return 0, false
	}
	if node.Kind == shimast.KindNumericLiteral {
		switch numericLiteralText(node) {
		case "0":
			return 0, true
		case "1":
			return 1, true
		}
		return 0, false
	}
	if node.Kind != shimast.KindPrefixUnaryExpression {
		return 0, false
	}
	prefix := node.AsPrefixUnaryExpression()
	if prefix == nil || prefix.Operand == nil {
		return 0, false
	}
	if prefix.Operand.Kind != shimast.KindNumericLiteral {
		return 0, false
	}
	text := numericLiteralText(prefix.Operand)
	switch prefix.Operator {
	case shimast.KindMinusToken:
		if text == "1" {
			return -1, true
		}
		if text == "0" {
			return 0, true
		}
	case shimast.KindPlusToken:
		if text == "0" {
			return 0, true
		}
		if text == "1" {
			return 1, true
		}
	}
	return 0, false
}

// preferIncludesFlipOperator returns the operator that has the same
// boolean meaning when the operands are swapped. `a < b` flipped is
// `b > a`, `a >= b` flipped is `b <= a`, and equality operators are
// symmetric so they are returned unchanged.
func preferIncludesFlipOperator(kind shimast.Kind) shimast.Kind {
	switch kind {
	case shimast.KindLessThanToken:
		return shimast.KindGreaterThanToken
	case shimast.KindLessThanEqualsToken:
		return shimast.KindGreaterThanEqualsToken
	case shimast.KindGreaterThanToken:
		return shimast.KindLessThanToken
	case shimast.KindGreaterThanEqualsToken:
		return shimast.KindLessThanEqualsToken
	}
	return kind
}

// preferIncludesIsPresenceComparison reports whether `op` paired with
// `value` is one of the equivalences for "the element is present":
// `!= -1`, `>= 0`, `> -1` mean "present"; `== -1`, `< 0`, `<= -1`
// mean "absent". Either polarity is rewritable to `includes(x)` (the
// "absent" cases negate the call), so both pass.
func preferIncludesIsPresenceComparison(op shimast.Kind, value int) bool {
	switch op {
	case shimast.KindExclamationEqualsToken, shimast.KindExclamationEqualsEqualsToken:
		return value == -1
	case shimast.KindEqualsEqualsToken, shimast.KindEqualsEqualsEqualsToken:
		return value == -1
	case shimast.KindGreaterThanEqualsToken:
		return value == 0
	case shimast.KindGreaterThanToken:
		return value == -1
	case shimast.KindLessThanToken:
		return value == 0
	case shimast.KindLessThanEqualsToken:
		return value == -1
	}
	return false
}

// preferIncludesIsArrayOrString reports whether t is provably an
// array, tuple, or string. The constituent-recursion shape mirrors
// `requireArraySortCompareIsArrayLike`: a union like `string[] |
// string` is still accepted because every constituent is rewritable.
// `any` / `unknown` / `never` are intentionally NOT treated as
// matching — they leak from generic helpers and would explode the
// false-positive volume on user-defined `indexOf` methods.
func preferIncludesIsArrayOrString(checker *shimchecker.Checker, t *shimchecker.Type) bool {
	if checker == nil || t == nil {
		return false
	}
	flags := t.Flags()
	if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
		return false
	}
	if flags&shimchecker.TypeFlagsStringLike != 0 {
		return true
	}
	if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
		for _, part := range t.Types() {
			if part == nil {
				continue
			}
			if !preferIncludesIsArrayOrString(checker, part) {
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
	Register(preferIncludes{})
}
