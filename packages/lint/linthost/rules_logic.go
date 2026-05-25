// Correctness and equality rules — a focused set from ESLint's "Possible
// Problems" and "Suggestions" categories that catch logic errors rather than
// style issues: redundant boolean casts, unsafe negations, loose equality,
// NaN comparisons, constant conditions, and assignment-in-condition.
// AST-only, no scope analysis.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// noExtraBooleanCast: `if (!!x)`, `if (Boolean(x))`, `Boolean(!!x)` —
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
    if call.QuestionDotToken != nil {
      return
    }
    if !isInBooleanContext(node) {
      return
    }
    message := "Redundant Boolean call."
    // Only autofix when there is exactly one positional argument: zero
    // arguments produce `undefined → false`, and multi-arg calls signal the
    // author may be passing through an unrelated value as the second slot.
    // Spread arguments hide the runtime shape, so skip those as well.
    if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
      ctx.Report(node, message)
      return
    }
    arg := call.Arguments.Nodes[0]
    if arg == nil || arg.Kind == shimast.KindSpreadElement {
      ctx.Report(node, message)
      return
    }
    src := ctx.File.Text()
    argStart := shimscanner.SkipTrivia(src, arg.Pos())
    argEnd := arg.End()
    if argStart < 0 || argStart >= argEnd || argEnd > len(src) {
      ctx.Report(node, message)
      return
    }
    editPos := shimscanner.SkipTrivia(src, node.Pos())
    if editPos < 0 || editPos >= node.End() {
      ctx.Report(node, message)
      return
    }
    ctx.ReportFix(
      node,
      message,
      TextEdit{Pos: editPos, End: node.End(), Text: src[argStart:argEnd]},
    )
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
    if !isInBooleanContext(node) {
      return
    }
    message := "Redundant double negation."
    if inner.Operand == nil {
      ctx.Report(node, message)
      return
    }
    src := ctx.File.Text()
    inStart := shimscanner.SkipTrivia(src, inner.Operand.Pos())
    inEnd := inner.Operand.End()
    if inStart < 0 || inStart >= inEnd || inEnd > len(src) {
      ctx.Report(node, message)
      return
    }
    editPos := shimscanner.SkipTrivia(src, node.Pos())
    if editPos < 0 || editPos >= node.End() {
      ctx.Report(node, message)
      return
    }
    ctx.ReportFix(
      node,
      message,
      TextEdit{Pos: editPos, End: node.End(), Text: src[inStart:inEnd]},
    )
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

// skipParents walks up through any wrapping ParenthesizedExpression nodes and
// returns the outermost parenthesized wrapper. This is the inverse of
// stripParens: where stripParens descends into the canonical inner expression,
// skipParents climbs up to the outermost paren so that structural parent
// comparisons (e.g. "is this expression the test of an if?") resolve against
// the node the parser actually attached as a child, not the inner form.
func skipParents(node *shimast.Node) *shimast.Node {
  for node != nil && node.Parent != nil && node.Parent.Kind == shimast.KindParenthesizedExpression {
    node = node.Parent
  }
  return node
}

// noUnsafeNegation: `!a in b` and `!a instanceof b` — the parser
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
    reportEqeqeq(ctx, expr.OperatorToken, expr, "Expected '===' and instead saw '=='.", "===")
  case shimast.KindExclamationEqualsToken:
    reportEqeqeq(ctx, expr.OperatorToken, expr, "Expected '!==' and instead saw '!='.", "!==")
  }
}

func reportEqeqeq(ctx *Context, operator *shimast.Node, expr *shimast.BinaryExpression, message, replacement string) {
  pos, end := tokenRange(ctx.File, operator)
  if pos < 0 {
    pos, end = operator.Pos(), operator.End()
  }
  if isEqeqeqAutoFixSafe(expr) {
    ctx.ReportRangeFix(
      pos,
      end,
      message,
      TextEdit{Pos: pos, End: end, Text: replacement},
    )
    return
  }
  ctx.ReportRange(pos, end, message)
}

func isEqeqeqAutoFixSafe(expr *shimast.BinaryExpression) bool {
  if expr == nil {
    return false
  }
  left := stripParens(expr.Left)
  right := stripParens(expr.Right)
  if left == nil || right == nil {
    return false
  }
  if left.Kind == shimast.KindTypeOfExpression || right.Kind == shimast.KindTypeOfExpression {
    return true
  }
  leftKind := comparableLiteralKind(left)
  return leftKind != "" && leftKind == comparableLiteralKind(right)
}

func comparableLiteralKind(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindStringLiteral:
    return "string"
  case shimast.KindNumericLiteral:
    return "number"
  case shimast.KindBigIntLiteral:
    return "bigint"
  case shimast.KindTrueKeyword, shimast.KindFalseKeyword:
    return "boolean"
  case shimast.KindNullKeyword:
    return "object"
  }
  return ""
}

// useIsNaN: `x === NaN` is always false. Use `Number.isNaN(x)`.
// https://eslint.org/docs/latest/rules/use-isnan
type useIsNaN struct{}

func (useIsNaN) Name() string           { return "use-isnan" }
func (useIsNaN) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (useIsNaN) Check(ctx *Context, node *shimast.Node) {
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

// validTypeof: typeof expressions can only be compared to known type
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

// noCompareNegZero: `x === -0`. Comparison ignores the sign — use
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

// noCondAssign: `if (a = b)` is almost always a typo for `if (a == b)`.
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
    shimast.KindMinusEqualsToken,
    shimast.KindAsteriskEqualsToken,
    shimast.KindAsteriskAsteriskEqualsToken,
    shimast.KindSlashEqualsToken,
    shimast.KindPercentEqualsToken,
    shimast.KindLessThanLessThanEqualsToken,
    shimast.KindGreaterThanGreaterThanEqualsToken,
    shimast.KindGreaterThanGreaterThanGreaterThanEqualsToken,
    shimast.KindAmpersandEqualsToken,
    shimast.KindBarEqualsToken,
    shimast.KindCaretEqualsToken,
    shimast.KindAmpersandAmpersandEqualsToken,
    shimast.KindBarBarEqualsToken,
    shimast.KindQuestionQuestionEqualsToken:
    return true
  }
  return false
}

// noConstantCondition: `if (true)`, `while (1)`, `if (literal)`. Often
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
  Register(useIsNaN{})
  Register(validTypeof{})
  Register(noCompareNegZero{})
  Register(noCondAssign{})
  Register(noConstantCondition{})
}
