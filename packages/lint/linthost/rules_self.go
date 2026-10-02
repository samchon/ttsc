package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noSelfAssign: detect `x = x` / `obj.foo = obj.foo`. Both sides must be the
// same reference chain (see isSameReference), so a call on either side, whose
// result can differ between evaluations, is never reported.
// https://eslint.org/docs/latest/rules/no-self-assign
type noSelfAssign struct{}

func (noSelfAssign) Name() string           { return "no-self-assign" }
func (noSelfAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noSelfAssign) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return
  }
  if expr.OperatorToken.Kind != shimast.KindEqualsToken {
    return
  }
  left := stripParens(expr.Left)
  right := stripParens(expr.Right)
  if left == nil || right == nil {
    return
  }
  if !isAssignableLeftHand(left) {
    return
  }
  if isSameReference(left, right) {
    ctx.Report(node, "Self-assignment of a variable.")
  }
}

// isSameReference reports whether two expressions denote the same reference
// without evaluating anything: identifiers, `this`, `super` and literals with
// the same value, and property or element accesses whose objects and keys are
// themselves the same reference. Any other shape, notably a call, is never the
// same reference, because evaluating it twice can yield different values. This
// mirrors the reference comparison ESLint's no-self-assign and no-self-compare
// share.
func isSameReference(left, right *shimast.Node) bool {
  left = stripParens(left)
  right = stripParens(right)
  if left == nil || right == nil || left.Kind != right.Kind {
    return false
  }
  switch left.Kind {
  case shimast.KindIdentifier:
    return identifierText(left) == identifierText(right)
  case shimast.KindThisKeyword, shimast.KindSuperKeyword, shimast.KindTrueKeyword,
    shimast.KindFalseKeyword, shimast.KindNullKeyword:
    return true
  case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
    return stringLiteralText(left) == stringLiteralText(right)
  case shimast.KindNumericLiteral, shimast.KindBigIntLiteral:
    return numericLiteralText(left) == numericLiteralText(right)
  case shimast.KindPropertyAccessExpression:
    a, b := left.AsPropertyAccessExpression(), right.AsPropertyAccessExpression()
    return a != nil && b != nil && identifierText(a.Name()) == identifierText(b.Name()) &&
      isSameReference(a.Expression, b.Expression)
  case shimast.KindElementAccessExpression:
    a, b := left.AsElementAccessExpression(), right.AsElementAccessExpression()
    return a != nil && b != nil && isSameReference(a.Expression, b.Expression) &&
      isSameReference(a.ArgumentExpression, b.ArgumentExpression)
  }
  return false
}

// isAssignableLeftHand reports whether node can appear as the left-hand side
// of a plain assignment expression. Only simple identifier and member-access
// shapes are checked here; complex destructuring patterns are excluded because
// a textual equality test would produce too many false negatives.
func isAssignableLeftHand(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindIdentifier, shimast.KindPropertyAccessExpression, shimast.KindElementAccessExpression:
    return true
  }
  return false
}

// noSelfCompare: `x === x`, `x !== x`, etc. Useful for catching typos
// where the developer meant to compare against a different value. Operands
// are compared as reference chains, so `f() === f()` is not reported.
// https://eslint.org/docs/latest/rules/no-self-compare
type noSelfCompare struct{}

func (noSelfCompare) Name() string           { return "no-self-compare" }
func (noSelfCompare) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noSelfCompare) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return
  }
  if !isComparisonOperator(expr.OperatorToken.Kind) {
    return
  }
  left := stripParens(expr.Left)
  right := stripParens(expr.Right)
  if left == nil || right == nil {
    return
  }
  if isSameReference(left, right) {
    ctx.Report(node, "Comparing to itself is potentially pointless.")
  }
}

// isComparisonOperator reports whether kind is one of the eight standard
// comparison operators: ==, ===, !=, !==, <, >, <=, >=. Rules whose upstream
// operator set spans both equality and ordering (no-self-compare, use-isnan,
// no-compare-neg-zero, yoda) gate on this one.
func isComparisonOperator(kind shimast.Kind) bool {
  switch kind {
  case
    shimast.KindEqualsEqualsToken,
    shimast.KindEqualsEqualsEqualsToken,
    shimast.KindExclamationEqualsToken,
    shimast.KindExclamationEqualsEqualsToken,
    shimast.KindLessThanToken,
    shimast.KindGreaterThanToken,
    shimast.KindLessThanEqualsToken,
    shimast.KindGreaterThanEqualsToken:
    return true
  }
  return false
}

// isEqualityOperator reports whether kind is one of the four equality
// operators: ==, ===, !=, !==. It is the sameness-testing half of
// isComparisonOperator, for the rules whose upstream operator set stops at
// equality (valid-typeof, security/detect-possible-timing-attacks): the four
// relational operators order their operands instead of testing them for
// identity.
func isEqualityOperator(kind shimast.Kind) bool {
  switch kind {
  case
    shimast.KindEqualsEqualsToken,
    shimast.KindEqualsEqualsEqualsToken,
    shimast.KindExclamationEqualsToken,
    shimast.KindExclamationEqualsEqualsToken:
    return true
  }
  return false
}

func init() {
  Register(noSelfAssign{})
  Register(noSelfCompare{})
}
