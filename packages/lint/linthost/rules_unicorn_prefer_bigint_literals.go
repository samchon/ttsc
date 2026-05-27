// unicorn/prefer-bigint-literals: `BigInt(1)` and `BigInt("1")` both
// allocate a BigInt at runtime through a constructor call, while the
// equivalent `1n` literal is one parse-time token with no call
// overhead. The rule asks authors to use the literal form when the
// argument is a known integer.
//
// AST-only: visit `KindCallExpression`, fire when the callee is the
// bare `BigInt` identifier called with exactly one argument that is
// either a numeric literal of any shape, or a string literal whose
// content is a decimal-digit-only integer (optionally signed). The
// conservative string check avoids flagging `BigInt("0x10")` and
// other shapes that need a runtime parse.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-bigint-literals.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferBigintLiterals struct{}

func (unicornPreferBigintLiterals) Name() string { return "unicorn/prefer-bigint-literals" }
func (unicornPreferBigintLiterals) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferBigintLiterals) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || identifierText(call.Expression) != "BigInt" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
		return
	}
	arg := stripParens(call.Arguments.Nodes[0])
	if arg == nil {
		return
	}
	switch arg.Kind {
	case shimast.KindNumericLiteral:
		// `BigInt(1)` — always rewritable to `1n`.
	case shimast.KindStringLiteral:
		text := stringLiteralText(arg)
		if !unicornPreferBigintLiteralsIsDecimalInteger(text) {
			return
		}
	default:
		return
	}
	ctx.Report(node, "Prefer BigInt literal `1n` over `BigInt(1)`.")
}

// unicornPreferBigintLiteralsIsDecimalInteger reports whether `text` is
// a non-empty decimal-integer literal — digits only, optional leading
// minus. The check is intentionally conservative; anything more exotic
// (hex prefix, exponent, decimal point) leaves the BigInt call alone.
func unicornPreferBigintLiteralsIsDecimalInteger(text string) bool {
	if text == "" {
		return false
	}
	i := 0
	if text[0] == '-' || text[0] == '+' {
		i++
	}
	if i == len(text) {
		return false
	}
	for ; i < len(text); i++ {
		ch := text[i]
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

func init() {
	Register(unicornPreferBigintLiterals{})
}
