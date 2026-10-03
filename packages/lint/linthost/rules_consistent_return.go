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

// blockAlwaysExits reports whether a function-body block can never fall off its
// end: every reachable path leaves through `return` or `throw`.
func blockAlwaysExits(body *shimast.Node) bool {
  if body == nil || body.Kind != shimast.KindBlock {
    return false
  }
  return statementCannotComplete(body, false)
}

// statementCannotComplete reports whether control can never continue past
// `stmt`. A `return` or `throw` ends it, a block ends when any of its
// statements does, an `if` ends when both branches do, a `switch` ends when it
// has a `default`, its last clause ends and no `break` leaves it, a `try` ends
// when its `finally` does or when its try and catch blocks both do, and a loop
// with a constant `true` condition and no `break` never completes.
//
// With valueOnly, a `return` ends the statement only when it carries a value,
// so a bare `return;` still lets a getter produce `undefined`. The analysis is
// one-sided: any shape it cannot settle counts as able to complete, so a
// reported function really has a path that falls off its end.
func statementCannotComplete(stmt *shimast.Node, valueOnly bool) bool {
  if stmt == nil {
    return false
  }
  switch stmt.Kind {
  case shimast.KindReturnStatement:
    if !valueOnly {
      return true
    }
    ret := stmt.AsReturnStatement()
    return ret != nil && ret.Expression != nil
  case shimast.KindThrowStatement:
    return true
  case shimast.KindBlock:
    for _, child := range stmt.Statements() {
      if statementCannotComplete(child, valueOnly) {
        return true
      }
    }
    return false
  case shimast.KindIfStatement:
    ifStmt := stmt.AsIfStatement()
    if ifStmt == nil || ifStmt.ThenStatement == nil || ifStmt.ElseStatement == nil {
      return false
    }
    return statementCannotComplete(ifStmt.ThenStatement, valueOnly) &&
      statementCannotComplete(ifStmt.ElseStatement, valueOnly)
  case shimast.KindSwitchStatement:
    return switchCannotComplete(stmt, valueOnly)
  case shimast.KindTryStatement:
    try := stmt.AsTryStatement()
    if try == nil || try.TryBlock == nil {
      return false
    }
    if try.FinallyBlock != nil && statementCannotComplete(try.FinallyBlock, valueOnly) {
      return true
    }
    if !statementCannotComplete(try.TryBlock, valueOnly) {
      return false
    }
    if try.CatchClause == nil {
      return true
    }
    clause := try.CatchClause.AsCatchClause()
    return clause != nil && statementCannotComplete(clause.Block, valueOnly)
  case shimast.KindWhileStatement:
    loop := stmt.AsWhileStatement()
    return loop != nil && isConstantTrue(loop.Expression) && !containsBreakOut(loop.Statement)
  case shimast.KindDoStatement:
    loop := stmt.AsDoStatement()
    return loop != nil && isConstantTrue(loop.Expression) && !containsBreakOut(loop.Statement)
  case shimast.KindForStatement:
    loop := stmt.AsForStatement()
    return loop != nil && (loop.Condition == nil || isConstantTrue(loop.Condition)) &&
      !containsBreakOut(loop.Statement)
  }
  return false
}

// switchCannotComplete handles a `switch` whose every path leaves the function.
// Clauses fall through into the next one, so only the last clause has to end,
// but a `default` must exist and no `break` may leave the switch early.
func switchCannotComplete(stmt *shimast.Node, valueOnly bool) bool {
  sw := stmt.AsSwitchStatement()
  if sw == nil || sw.CaseBlock == nil {
    return false
  }
  block := sw.CaseBlock.AsCaseBlock()
  if block == nil || block.Clauses == nil || len(block.Clauses.Nodes) == 0 {
    return false
  }
  hasDefault := false
  for _, clause := range block.Clauses.Nodes {
    if clause == nil {
      return false
    }
    if clause.Kind == shimast.KindDefaultClause {
      hasDefault = true
    }
    entry := clause.AsCaseOrDefaultClause()
    if entry == nil {
      return false
    }
    if entry.Statements != nil {
      for _, child := range entry.Statements.Nodes {
        if containsBreakOut(child) {
          return false
        }
      }
    }
  }
  if !hasDefault {
    return false
  }
  last := block.Clauses.Nodes[len(block.Clauses.Nodes)-1].AsCaseOrDefaultClause()
  if last == nil || last.Statements == nil {
    return false
  }
  for _, child := range last.Statements.Nodes {
    if statementCannotComplete(child, valueOnly) {
      return true
    }
  }
  return false
}

// isConstantTrue reports whether node is the literal `true`, possibly
// parenthesized.
func isConstantTrue(node *shimast.Node) bool {
  node = stripParens(node)
  return node != nil && node.Kind == shimast.KindTrueKeyword
}

// containsBreakOut reports whether `node` holds a `break` that can leave the
// statement enclosing it: an unlabeled `break` outside any nested loop or
// switch, or any labeled `break`. Function bodies are separate scopes.
func containsBreakOut(node *shimast.Node) bool {
  var walk func(n *shimast.Node, nested bool) bool
  walk = func(n *shimast.Node, nested bool) bool {
    if n == nil || isFunctionLikeKind(n) {
      return false
    }
    if n.Kind == shimast.KindBreakStatement {
      statement := n.AsBreakStatement()
      if statement != nil && statement.Label != nil {
        return true
      }
      return !nested
    }
    inner := nested
    switch n.Kind {
    case shimast.KindForStatement, shimast.KindForInStatement, shimast.KindForOfStatement,
      shimast.KindWhileStatement, shimast.KindDoStatement, shimast.KindSwitchStatement:
      inner = true
    }
    found := false
    n.ForEachChild(func(child *shimast.Node) bool {
      if walk(child, inner) {
        found = true
        return true
      }
      return false
    })
    return found
  }
  return walk(node, false)
}

func init() {
  Register(consistentReturn{})
}
