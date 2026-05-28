// unicorn/prefer-includes: `arr.indexOf(x) !== -1` (and its `=== -1`,
// `> -1`, `>= 0`, `< 0` siblings) is the legacy idiom for membership
// testing. The intent is obvious only after the reader translates the
// magic number; `arr.includes(x)` says the same thing without the
// translation step. The rule applies to both arrays and strings — both
// expose `indexOf` and both expose `includes`.
//
// AST-only: a `BinaryExpression` whose operator is one of the
// recognized comparisons and whose operands are `<call>.indexOf(...)`
// vs. one of `-1` / `0` (allowing the literal-or-unary-minus shape for
// `-1`) matches. For symmetric operators (`===`, `!==`, `==`, `!=`)
// either operand may carry the call. For asymmetric operators (`<`,
// `>=`, `>`) only the canonical orientation `indexOf(x) <op> <literal>`
// is recognized; the swapped form (`0 < indexOf(x)`) has different
// semantics (e.g. "found at index >= 1") and is intentionally NOT
// rewritten to `includes`.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-includes.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferIncludes struct{}

func (unicornPreferIncludes) Name() string { return "unicorn/prefer-includes" }
func (unicornPreferIncludes) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (unicornPreferIncludes) Check(ctx *Context, node *shimast.Node) {
	bin := node.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil || bin.Left == nil || bin.Right == nil {
		return
	}
	op := bin.OperatorToken.Kind
	wantNegOne := false
	wantZero := false
	switch op {
	case shimast.KindEqualsEqualsEqualsToken,
		shimast.KindExclamationEqualsEqualsToken,
		shimast.KindEqualsEqualsToken,
		shimast.KindExclamationEqualsToken:
		wantNegOne = true
	case shimast.KindLessThanToken:
		// `indexOf(x) < 0`
		wantZero = true
	case shimast.KindGreaterThanEqualsToken:
		// `indexOf(x) >= 0`
		wantZero = true
	case shimast.KindGreaterThanToken:
		// Not in the canonical set for this orientation; handled below
		// via `> -1` matching against the negative-one form.
		wantNegOne = true
	default:
		return
	}
	left := stripParens(bin.Left)
	right := stripParens(bin.Right)
	matched := unicornPreferIncludesMatches(left, right, op, wantNegOne, wantZero)
	// Equality is symmetric — also try the swapped orientation.
	// Asymmetric operators (`<`, `>=`, `>`) only match the canonical
	// orientation; swapping `indexOf(x) < 0` to `0 < indexOf(x)` changes
	// the meaning ("found at index >= 1") and must not be rewritten.
	if !matched {
		switch op {
		case shimast.KindEqualsEqualsEqualsToken,
			shimast.KindExclamationEqualsEqualsToken,
			shimast.KindEqualsEqualsToken,
			shimast.KindExclamationEqualsToken:
			matched = unicornPreferIncludesMatches(right, left, op, wantNegOne, wantZero)
		}
	}
	if matched {
		ctx.Report(node, "Prefer `Array#includes()` / `String#includes()` over `indexOf` comparisons.")
	}
}

func unicornPreferIncludesMatches(
	callSide, literalSide *shimast.Node,
	op shimast.Kind,
	wantNegOne, wantZero bool,
) bool {
	if callSide == nil || literalSide == nil {
		return false
	}
	if callSide.Kind != shimast.KindCallExpression {
		return false
	}
	call := callSide.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return false
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Name()) != "indexOf" {
		return false
	}
	// `> -1`, `>= 0`, `< 0`, `=== -1`, `!== -1`, `== -1`, `!= -1`.
	switch op {
	case shimast.KindGreaterThanToken:
		// Only `indexOf(x) > -1` matches.
		return unicornPreferIncludesIsNegativeOne(literalSide)
	case shimast.KindLessThanToken:
		// Only `indexOf(x) < 0` matches.
		return unicornPreferIncludesIsZero(literalSide)
	case shimast.KindGreaterThanEqualsToken:
		// Only `indexOf(x) >= 0` matches.
		return unicornPreferIncludesIsZero(literalSide)
	}
	if wantNegOne && unicornPreferIncludesIsNegativeOne(literalSide) {
		return true
	}
	if wantZero && unicornPreferIncludesIsZero(literalSide) {
		return true
	}
	return false
}

func unicornPreferIncludesIsNegativeOne(node *shimast.Node) bool {
	node = stripParens(node)
	if node == nil {
		return false
	}
	if node.Kind == shimast.KindPrefixUnaryExpression {
		prefix := node.AsPrefixUnaryExpression()
		if prefix == nil || prefix.Operator != shimast.KindMinusToken || prefix.Operand == nil {
			return false
		}
		if prefix.Operand.Kind != shimast.KindNumericLiteral {
			return false
		}
		return numericLiteralText(prefix.Operand) == "1"
	}
	if node.Kind == shimast.KindNumericLiteral {
		// Some tokenizers preserve the leading `-` in the literal text.
		return numericLiteralText(node) == "-1"
	}
	return false
}

func unicornPreferIncludesIsZero(node *shimast.Node) bool {
	node = stripParens(node)
	if node == nil || node.Kind != shimast.KindNumericLiteral {
		return false
	}
	return numericLiteralText(node) == "0"
}

func init() {
	Register(unicornPreferIncludes{})
}
