// unicorn/prefer-string-starts-ends-with: `s.slice(0, 4) === "http"` and
// `s.slice(-3) === "abc"` are the legacy spellings of `s.startsWith(...)`
// and `s.endsWith(...)`. The String methods are clearer about intent, do
// not allocate the intermediate substring, and have been available for
// over a decade.
//
// AST-only: visit each `BinaryExpression` whose operator is `===` or
// `!==`. One operand must be a `CallExpression` of the shape
// `_.slice(0, N)` or `_.slice(-N)` (the `-N` form being a unary minus
// over a numeric literal) and the other operand must be a string literal
// whose text length matches N. Reports on the binary expression.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-starts-ends-with.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferStringStartsEndsWith struct{}

func (unicornPreferStringStartsEndsWith) Name() string {
	return "unicorn/prefer-string-starts-ends-with"
}
func (unicornPreferStringStartsEndsWith) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (unicornPreferStringStartsEndsWith) Check(ctx *Context, node *shimast.Node) {
	bin := node.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil || bin.Left == nil || bin.Right == nil {
		return
	}
	switch bin.OperatorToken.Kind {
	case shimast.KindEqualsEqualsEqualsToken,
		shimast.KindExclamationEqualsEqualsToken:
	default:
		return
	}
	left := stripParens(bin.Left)
	right := stripParens(bin.Right)
	if unicornPreferStringStartsEndsWithMatches(left, right) ||
		unicornPreferStringStartsEndsWithMatches(right, left) {
		ctx.Report(node, "Prefer `String#startsWith()` / `String#endsWith()` over slice-and-compare.")
	}
}

// unicornPreferStringStartsEndsWithMatches reports whether `callSide` is
// the slice call and `literalSide` is a matching string literal.
func unicornPreferStringStartsEndsWithMatches(callSide, literalSide *shimast.Node) bool {
	if callSide == nil || literalSide == nil {
		return false
	}
	if callSide.Kind != shimast.KindCallExpression {
		return false
	}
	if literalSide.Kind != shimast.KindStringLiteral &&
		literalSide.Kind != shimast.KindNoSubstitutionTemplateLiteral {
		return false
	}
	call := callSide.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return false
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Name()) != "slice" {
		return false
	}
	if call.Arguments == nil {
		return false
	}
	args := call.Arguments.Nodes
	wantLen := -1
	switch len(args) {
	case 2:
		first := stripParens(args[0])
		second := stripParens(args[1])
		if first == nil || first.Kind != shimast.KindNumericLiteral ||
			numericLiteralText(first) != "0" {
			return false
		}
		if second == nil || second.Kind != shimast.KindNumericLiteral {
			return false
		}
		if !unicornPreferStringStartsEndsWithDigits(numericLiteralText(second)) {
			return false
		}
		wantLen = unicornPreferStringStartsEndsWithToInt(numericLiteralText(second))
	case 1:
		// `.slice(-N)` — a unary minus over a positive numeric literal.
		only := stripParens(args[0])
		if only == nil || only.Kind != shimast.KindPrefixUnaryExpression {
			return false
		}
		prefix := only.AsPrefixUnaryExpression()
		if prefix == nil || prefix.Operator != shimast.KindMinusToken ||
			prefix.Operand == nil ||
			prefix.Operand.Kind != shimast.KindNumericLiteral {
			return false
		}
		text := numericLiteralText(prefix.Operand)
		if !unicornPreferStringStartsEndsWithDigits(text) {
			return false
		}
		wantLen = unicornPreferStringStartsEndsWithToInt(text)
	default:
		return false
	}
	if wantLen <= 0 {
		return false
	}
	return len(stringLiteralText(literalSide)) == wantLen
}

// unicornPreferStringStartsEndsWithDigits reports whether `text` is a
// non-empty ASCII decimal-integer literal. Decimals, hex, and `e`-notation
// are rejected since the rule only handles fixed-length prefixes.
func unicornPreferStringStartsEndsWithDigits(text string) bool {
	if text == "" {
		return false
	}
	for i := 0; i < len(text); i++ {
		c := text[i]
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// unicornPreferStringStartsEndsWithToInt parses an ASCII decimal-integer
// literal into an int. Callers must have validated the input first; this
// helper returns -1 only as a defensive fallback for an overflow guard.
func unicornPreferStringStartsEndsWithToInt(text string) int {
	n := 0
	for i := 0; i < len(text); i++ {
		c := text[i]
		if c < '0' || c > '9' {
			return -1
		}
		n = n*10 + int(c-'0')
		if n > 1<<30 {
			return -1
		}
	}
	return n
}

func init() {
	Register(unicornPreferStringStartsEndsWith{})
}
