// unicorn/prefer-modern-math-apis: `Math.log(x) * Math.LOG10E` is the
// classical pre-ES2015 spelling of `Math.log10(x)`. The arithmetic
// identity is exact in the abstract but loses precision once it goes
// through IEEE-754 multiplication, and the modern call also reads as
// the operation it actually performs. The rule flags the multiplication
// form for `LOG10E` and `LOG2E`.
//
// AST-only: visit `KindBinaryExpression`. Fire when the operator is `*`
// and one operand is `Math.log(...)` while the other is
// `PropertyAccess(Identifier("Math"), LOG10E)` or `LOG2E`. The
// commutative `*` operator means `Math.log(x) * Math.LOG10E` and
// `Math.LOG10E * Math.log(x)` both match.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-modern-math-apis.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferModernMathApis struct{}

func (unicornPreferModernMathApis) Name() string { return "unicorn/prefer-modern-math-apis" }
func (unicornPreferModernMathApis) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (unicornPreferModernMathApis) Check(ctx *Context, node *shimast.Node) {
	bin := node.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil ||
		bin.OperatorToken.Kind != shimast.KindAsteriskToken {
		return
	}
	left := stripParens(bin.Left)
	right := stripParens(bin.Right)
	if unicornPreferModernMathApisMatchesPair(left, right) ||
		unicornPreferModernMathApisMatchesPair(right, left) {
		ctx.Report(node, "Prefer `Math.log10(x)` / `Math.log2(x)` over `Math.log(x) * Math.LOG10E` / `Math.log(x) * Math.LOG2E`.")
	}
}

// unicornPreferModernMathApisMatchesPair reports whether `callSide` is
// `Math.log(...)` and `constSide` is `Math.LOG10E` or `Math.LOG2E`.
func unicornPreferModernMathApisMatchesPair(callSide, constSide *shimast.Node) bool {
	if callSide == nil || constSide == nil {
		return false
	}
	if callSide.Kind != shimast.KindCallExpression {
		return false
	}
	call := callSide.AsCallExpression()
	if call == nil || call.Expression == nil {
		return false
	}
	if !isMatchingPropertyAccess(call.Expression, "Math", "log") {
		return false
	}
	if constSide.Kind != shimast.KindPropertyAccessExpression {
		return false
	}
	prop := constSide.AsPropertyAccessExpression()
	if prop == nil || identifierText(prop.Expression) != "Math" {
		return false
	}
	switch identifierText(prop.Name()) {
	case "LOG10E", "LOG2E":
		return true
	}
	return false
}

func init() {
	Register(unicornPreferModernMathApis{})
}
