package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-extra-boolean-cast: `if (!!x)`, `if (Boolean(x))`, `Boolean(!!x)` —
// the conversion is implicit in a boolean context.
// https://eslint.org/docs/latest/rules/no-extra-boolean-cast
type noExtraBooleanCast struct{}

func (noExtraBooleanCast) Name() string { return "no-extra-boolean-cast" }
func (noExtraBooleanCast) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression, shimast.KindPrefixUnaryExpression}
}
func (noExtraBooleanCast) Check(ctx *Context, node *shimast.Node) {
	switch node.Kind {
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		if call == nil {
			return
		}
		if identifierText(call.Expression) != "Boolean" {
			return
		}
		if isInBooleanContext(node) {
			ctx.Report(node, "Redundant Boolean call.")
		}
	case shimast.KindPrefixUnaryExpression:
		outer := node.AsPrefixUnaryExpression()
		if outer == nil || outer.Operator != shimast.KindExclamationToken {
			return
		}
		operand := outer.Operand
		if operand == nil || operand.Kind != shimast.KindPrefixUnaryExpression {
			return
		}
		inner := operand.AsPrefixUnaryExpression()
		if inner == nil || inner.Operator != shimast.KindExclamationToken {
			return
		}
		if isInBooleanContext(node) {
			ctx.Report(node, "Redundant double negation.")
		}
	}
}

// isInBooleanContext walks up the parent chain to determine whether the
// expression's value is consumed as a boolean (test of an if/while/for/
// ternary, or operand of `!`).
func isInBooleanContext(node *shimast.Node) bool {
	parent := node.Parent
	for parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
		parent = parent.Parent
	}
	if parent == nil {
		return false
	}
	switch parent.Kind {
	case shimast.KindIfStatement:
		return parent.AsIfStatement().Expression == skipParents(node)
	case shimast.KindWhileStatement:
		return parent.AsWhileStatement().Expression == skipParents(node)
	case shimast.KindDoStatement:
		return parent.AsDoStatement().Expression == skipParents(node)
	case shimast.KindForStatement:
		return parent.AsForStatement().Condition == skipParents(node)
	case shimast.KindConditionalExpression:
		return parent.AsConditionalExpression().Condition == skipParents(node)
	case shimast.KindPrefixUnaryExpression:
		return parent.AsPrefixUnaryExpression().Operator == shimast.KindExclamationToken
	}
	return false
}

func skipParents(node *shimast.Node) *shimast.Node {
	for node != nil && node.Parent != nil && node.Parent.Kind == shimast.KindParenthesizedExpression {
		node = node.Parent
	}
	return node
}

// no-unsafe-negation: `!a in b` and `!a instanceof b` — the parser
// applies the negation to `a`, not to the whole comparison.
// https://eslint.org/docs/latest/rules/no-unsafe-negation
type noUnsafeNegation struct{}

func (noUnsafeNegation) Name() string           { return "no-unsafe-negation" }
func (noUnsafeNegation) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noUnsafeNegation) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	switch expr.OperatorToken.Kind {
	case shimast.KindInKeyword, shimast.KindInstanceOfKeyword:
	default:
		return
	}
	if expr.Left == nil || expr.Left.Kind != shimast.KindPrefixUnaryExpression {
		return
	}
	prefix := expr.Left.AsPrefixUnaryExpression()
	if prefix == nil || prefix.Operator != shimast.KindExclamationToken {
		return
	}
	ctx.Report(node, "Unexpected negating the left operand of a relational operator.")
}

// eqeqeq: enforce `===` / `!==`. Default mode matches ESLint's `always`
// preset — no exceptions for null comparison.
// https://eslint.org/docs/latest/rules/eqeqeq
type eqeqeq struct{}

func (eqeqeq) Name() string           { return "eqeqeq" }
func (eqeqeq) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (eqeqeq) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	switch expr.OperatorToken.Kind {
	case shimast.KindEqualsEqualsToken:
		ctx.ReportRange(expr.OperatorToken.Pos(), expr.OperatorToken.End(), "Expected '===' and instead saw '=='.")
	case shimast.KindExclamationEqualsToken:
		ctx.ReportRange(expr.OperatorToken.Pos(), expr.OperatorToken.End(), "Expected '!==' and instead saw '!='.")
	}
}

// use-isnan: `x === NaN` is always false. Use `Number.isNaN(x)`.
// https://eslint.org/docs/latest/rules/use-isnan
type useIsnan struct{}

func (useIsnan) Name() string           { return "use-isnan" }
func (useIsnan) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (useIsnan) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if !isComparisonOperator(expr.OperatorToken.Kind) {
		return
	}
	if identifierText(expr.Left) == "NaN" || identifierText(expr.Right) == "NaN" {
		ctx.Report(node, "Use the isNaN function to compare with NaN.")
	}
}

// valid-typeof: typeof expressions can only be compared to known type
// strings. Catches `typeof x === "stirng"`.
// https://eslint.org/docs/latest/rules/valid-typeof
type validTypeof struct{}

func (validTypeof) Name() string           { return "valid-typeof" }
func (validTypeof) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (validTypeof) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if !isComparisonOperator(expr.OperatorToken.Kind) {
		return
	}
	left := stripParens(expr.Left)
	right := stripParens(expr.Right)
	var literal *shimast.Node
	if left != nil && left.Kind == shimast.KindTypeOfExpression {
		literal = right
	} else if right != nil && right.Kind == shimast.KindTypeOfExpression {
		literal = left
	} else {
		return
	}
	if literal == nil {
		return
	}
	value := stringLiteralText(literal)
	if value == "" {
		return
	}
	if !isValidTypeofString(value) {
		ctx.Report(literal, "Invalid typeof comparison value.")
	}
}

func isValidTypeofString(value string) bool {
	switch value {
	case "undefined", "object", "boolean", "number", "string", "function", "symbol", "bigint":
		return true
	}
	return false
}

// no-compare-neg-zero: `x === -0`. Comparison ignores the sign — use
// `Object.is(x, -0)` if you really mean it.
// https://eslint.org/docs/latest/rules/no-compare-neg-zero
type noCompareNegZero struct{}

func (noCompareNegZero) Name() string           { return "no-compare-neg-zero" }
func (noCompareNegZero) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noCompareNegZero) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if !isComparisonOperator(expr.OperatorToken.Kind) {
		return
	}
	if isNegZero(expr.Left) || isNegZero(expr.Right) {
		ctx.Report(node, "Do not use the '-0' literal in comparisons.")
	}
}

func isNegZero(node *shimast.Node) bool {
	if node == nil || node.Kind != shimast.KindPrefixUnaryExpression {
		return false
	}
	prefix := node.AsPrefixUnaryExpression()
	if prefix == nil || prefix.Operator != shimast.KindMinusToken || prefix.Operand == nil {
		return false
	}
	return numericLiteralText(prefix.Operand) == "0"
}

// no-cond-assign: `if (a = b)` is almost always a typo for `if (a == b)`.
// Default mode matches ESLint's `except-parens` — wrapping in `( )`
// silences the rule.
// https://eslint.org/docs/latest/rules/no-cond-assign
type noCondAssign struct{}

func (noCondAssign) Name() string { return "no-cond-assign" }
func (noCondAssign) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindIfStatement,
		shimast.KindWhileStatement,
		shimast.KindDoStatement,
		shimast.KindForStatement,
		shimast.KindConditionalExpression,
	}
}
func (noCondAssign) Check(ctx *Context, node *shimast.Node) {
	var test *shimast.Node
	switch node.Kind {
	case shimast.KindIfStatement:
		test = node.AsIfStatement().Expression
	case shimast.KindWhileStatement:
		test = node.AsWhileStatement().Expression
	case shimast.KindDoStatement:
		test = node.AsDoStatement().Expression
	case shimast.KindForStatement:
		test = node.AsForStatement().Condition
	case shimast.KindConditionalExpression:
		test = node.AsConditionalExpression().Condition
	}
	if test == nil {
		return
	}
	// `except-parens`: an explicitly parenthesized assignment is OK.
	if test.Kind == shimast.KindParenthesizedExpression {
		return
	}
	if isAssignmentExpression(test) {
		ctx.Report(test, "Expected a conditional expression and instead saw an assignment.")
	}
}

func isAssignmentExpression(node *shimast.Node) bool {
	if node == nil || node.Kind != shimast.KindBinaryExpression {
		return false
	}
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return false
	}
	return isAssignmentOperator(expr.OperatorToken.Kind)
}

func isAssignmentOperator(kind shimast.Kind) bool {
	switch kind {
	case shimast.KindEqualsToken,
		shimast.KindPlusEqualsToken,
		shimast.KindMinusEqualsToken:
		return true
	}
	return false
}

// no-constant-condition: `if (true)`, `while (1)`, `if (literal)`. Often
// the result of leftover debug code or a typo.
// https://eslint.org/docs/latest/rules/no-constant-condition
type noConstantCondition struct{}

func (noConstantCondition) Name() string { return "no-constant-condition" }
func (noConstantCondition) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindIfStatement,
		shimast.KindWhileStatement,
		shimast.KindDoStatement,
		shimast.KindForStatement,
		shimast.KindConditionalExpression,
	}
}
func (noConstantCondition) Check(ctx *Context, node *shimast.Node) {
	var test *shimast.Node
	switch node.Kind {
	case shimast.KindIfStatement:
		test = node.AsIfStatement().Expression
	case shimast.KindWhileStatement:
		test = node.AsWhileStatement().Expression
	case shimast.KindDoStatement:
		test = node.AsDoStatement().Expression
	case shimast.KindForStatement:
		test = node.AsForStatement().Condition
	case shimast.KindConditionalExpression:
		test = node.AsConditionalExpression().Condition
	}
	test = stripParens(test)
	if test == nil {
		return // covers `for (;;)` — omitted condition is idiomatic.
	}
	// Allow `while (true)` since it's a common deliberate idiom.
	if node.Kind == shimast.KindWhileStatement {
		if v, ok := isLiteralBoolean(test); ok && v {
			return
		}
	}
	if isConstantTruthyOrFalsy(test) {
		ctx.Report(test, "Unexpected constant condition.")
	}
}

func isConstantTruthyOrFalsy(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	switch node.Kind {
	case
		shimast.KindNumericLiteral,
		shimast.KindBigIntLiteral,
		shimast.KindStringLiteral,
		shimast.KindNoSubstitutionTemplateLiteral,
		shimast.KindRegularExpressionLiteral,
		shimast.KindTrueKeyword,
		shimast.KindFalseKeyword,
		shimast.KindNullKeyword,
		shimast.KindArrayLiteralExpression,
		shimast.KindObjectLiteralExpression,
		shimast.KindArrowFunction,
		shimast.KindFunctionExpression:
		return true
	case shimast.KindPrefixUnaryExpression:
		prefix := node.AsPrefixUnaryExpression()
		if prefix == nil {
			return false
		}
		return isConstantTruthyOrFalsy(prefix.Operand)
	}
	return false
}

func init() {
	Register(noExtraBooleanCast{})
	Register(noUnsafeNegation{})
	Register(eqeqeq{})
	Register(useIsnan{})
	Register(validTypeof{})
	Register(noCompareNegZero{})
	Register(noCondAssign{})
	Register(noConstantCondition{})
}
