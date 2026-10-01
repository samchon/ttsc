// unicorn/prefer-type-error: a guard whose condition is a runtime
// `typeof` / `instanceof` check throws to signal "wrong type", not
// "wrong value". JavaScript's `TypeError` exists precisely for that
// distinction, and tooling (e.g. assertion libraries) treats the two
// error classes differently. The rule asks throwers to switch from
// `Error` to `TypeError` whenever the surrounding check is a type
// check.
//
// AST-only: visit every `IfStatement`, require its condition (after
// `stripParens`, optionally unwrapping a `!` prefix) to be a runtime
// type check — either a `KindTypeOfExpression`, a `KindBinaryExpression`
// with the `instanceof` operator, or a `==` / `===` / `!=` / `!==`
// comparison where one side is a `typeof` expression. The then-branch
// must be a single `KindThrowStatement` of `new Error(...)`. Fire on
// the throw.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-type-error.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferTypeError struct{}

func (unicornPreferTypeError) Name() string { return "unicorn/prefer-type-error" }
func (unicornPreferTypeError) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindIfStatement}
}
func (unicornPreferTypeError) Check(ctx *Context, node *shimast.Node) {
  stmt := node.AsIfStatement()
  if stmt == nil || stmt.Expression == nil || stmt.ThenStatement == nil {
    return
  }
  cond := stripParens(stmt.Expression)
  if cond == nil {
    return
  }
  // Accept either the bare type check (`typeof x !== "number"`) or a
  // negation of one (`!(x instanceof Foo)`).
  if cond.Kind == shimast.KindPrefixUnaryExpression {
    prefix := cond.AsPrefixUnaryExpression()
    if prefix == nil || prefix.Operator != shimast.KindExclamationToken {
      return
    }
    cond = stripParens(prefix.Operand)
  }
  if !unicornPreferTypeErrorIsTypeCheck(cond) {
    return
  }
  throw := unicornPreferTypeErrorSingleThrow(stmt.ThenStatement)
  if throw == nil {
    return
  }
  throwStmt := throw.AsThrowStatement()
  if throwStmt == nil {
    return
  }
  expr := stripParens(throwStmt.Expression)
  if expr == nil || expr.Kind != shimast.KindNewExpression {
    return
  }
  ne := expr.AsNewExpression()
  if ne == nil || identifierText(ne.Expression) != "Error" {
    return
  }
  ctx.Report(throw, "Throw `TypeError` (not `Error`) when the surrounding check is a runtime type check.")
}

// unicornPreferTypeErrorIsTypeCheck reports whether `node` is a
// `typeof x` expression or `x instanceof Y` BinaryExpression. Both
// shapes encode a runtime type test, which is what the rule keys off.
func unicornPreferTypeErrorIsTypeCheck(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindTypeOfExpression:
    return true
  case shimast.KindBinaryExpression:
    bin := node.AsBinaryExpression()
    if bin == nil || bin.OperatorToken == nil {
      return false
    }
    if bin.OperatorToken.Kind == shimast.KindInstanceOfKeyword {
      return true
    }
    // `typeof x !== "string"` style — covers the common idiom.
    switch bin.OperatorToken.Kind {
    case shimast.KindEqualsEqualsEqualsToken,
      shimast.KindEqualsEqualsToken,
      shimast.KindExclamationEqualsEqualsToken,
      shimast.KindExclamationEqualsToken:
      left := stripParens(bin.Left)
      right := stripParens(bin.Right)
      return (left != nil && left.Kind == shimast.KindTypeOfExpression) ||
        (right != nil && right.Kind == shimast.KindTypeOfExpression)
    }
  }
  return false
}

// unicornPreferTypeErrorSingleThrow returns the single `throw`
// statement inside `branch` — accepting either a bare ThrowStatement
// or a Block wrapping exactly one ThrowStatement. Returns nil for any
// other shape.
func unicornPreferTypeErrorSingleThrow(branch *shimast.Node) *shimast.Node {
  if branch == nil {
    return nil
  }
  if branch.Kind == shimast.KindThrowStatement {
    return branch
  }
  if branch.Kind != shimast.KindBlock {
    return nil
  }
  block := branch.AsBlock()
  if block == nil || block.Statements == nil || len(block.Statements.Nodes) != 1 {
    return nil
  }
  stmt := block.Statements.Nodes[0]
  if stmt == nil || stmt.Kind != shimast.KindThrowStatement {
    return nil
  }
  return stmt
}

func init() {
  Register(unicornPreferTypeError{})
}
