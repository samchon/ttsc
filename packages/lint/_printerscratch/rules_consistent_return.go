// consistentReturn reports a function whose `return` statements
// disagree on shape: at least one `return X;` carries a value and at
// least one bare `return;` (or implicit fall-through from the body)
// returns nothing. The resulting `T | undefined` return shape almost
// always indicates a missed branch — readers expect every caller to
// receive `T`, but a path leaks `undefined`.
// https://eslint.org/docs/latest/rules/consistent-return
//
// Conservative baseline: the walk stops at nested function-like
// boundaries so an inner closure's `return` does not get attributed
// to the surrounding function. Constructors are excluded — the
// language semantics of `return` inside `new`-invoked constructors
// are governed by `no-constructor-return` instead. Arrow functions
// with concise (expression-body) form are also excluded because they
// implicitly return their expression and have no `return` statement
// to disagree with.
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type consistentReturn struct{}

func (consistentReturn) Name() string { return "consistent-return" }
func (consistentReturn) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
  }
}
func (consistentReturn) Check(ctx *Context, node *shimast.Node) {
  body := node.Body()
  if body == nil || body.Kind != shimast.KindBlock {
    return
  }
  withValue := false
  withoutValue := false
  walkConsistentReturnBody(body, func(ret *shimast.Node) {
    stmt := ret.AsReturnStatement()
    if stmt == nil {
      return
    }
    if stmt.Expression != nil {
      withValue = true
    } else {
      withoutValue = true
    }
  })
  if withValue && withoutValue {
    ctx.Report(node, "Function expected to either always or never specify a return value.")
    return
  }
  // A function that returns a value on at least one path but can
  // also fall through the end of its block leaks an implicit
  // `undefined`. Flag it the same as the explicit mix above.
  if withValue && !blockAlwaysExits(body) {
    ctx.Report(node, "Function expected to either always or never specify a return value.")
  }
}

// walkConsistentReturnBody visits every `return` statement inside
// `root` without crossing nested function-like scopes. Nested
// function-likes report their own returns through their own visit.
func walkConsistentReturnBody(root *shimast.Node, visit func(*shimast.Node)) {
  if root == nil {
    return
  }
  var walk func(*shimast.Node)
  walk = func(n *shimast.Node) {
    if n == nil {
      return
    }
    if n != root && isFunctionLikeKind(n) {
      return
    }
    if n.Kind == shimast.KindReturnStatement {
      visit(n)
      return
    }
    n.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(root)
}

// blockAlwaysExits reports whether a function-body block can never
// fall off its end — every reachable path terminates with `return`,
// `throw`, or a nested block / `if` whose branches all terminate.
// Mirrors the shallow approximation `getter-return` uses.
func blockAlwaysExits(body *shimast.Node) bool {
  if body == nil || body.Kind != shimast.KindBlock {
    return false
  }
  stmts := body.Statements()
  if len(stmts) == 0 {
    return false
  }
  return statementAlwaysExits(stmts[len(stmts)-1])
}

// statementAlwaysExits reports whether `stmt` cannot fall through to
// the next statement: a `return`, a `throw`, a block ending in either
// of those, or an `if` whose branches both terminate.
func statementAlwaysExits(stmt *shimast.Node) bool {
  if stmt == nil {
    return false
  }
  switch stmt.Kind {
  case shimast.KindReturnStatement, shimast.KindThrowStatement:
    return true
  case shimast.KindBlock:
    return blockAlwaysExits(stmt)
  case shimast.KindIfStatement:
    ifStmt := stmt.AsIfStatement()
    if ifStmt == nil || ifStmt.ThenStatement == nil || ifStmt.ElseStatement == nil {
      return false
    }
    return statementAlwaysExits(ifStmt.ThenStatement) && statementAlwaysExits(ifStmt.ElseStatement)
  }
  return false
}

func init() {
  Register(consistentReturn{})
}
