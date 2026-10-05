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
// With valueOnly, completion kinds preserve bare returns even inside an earlier
// switch clause, endless loop or finally block. Unknown shapes are conservative
// possible completion, not proof that a runtime path actually falls through.
func statementCannotComplete(stmt *shimast.Node, valueOnly bool) bool {
  if valueOnly {
    return getterStatementCompletion(stmt)&(getterNormal|getterBareReturn|getterBreak|getterContinue|getterUnresolvedTransfer) == 0
  }
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

// Getter completion keeps an undefined-producing return separate from normal
// continuation. Abrupt outcomes survive sequential composition; finally can
// replace them, while switches and loops consume unlabeled local transfers.
// Labeled transfers remain unresolved rather than being consumed by a nested
// construct. Unknown statement shapes remain possible normal completion.
type getterCompletion uint8

const (
  getterNormal getterCompletion = 1 << iota
  getterValueReturn
  getterBareReturn
  getterThrow
  getterBreak
  getterContinue
  getterUnresolvedTransfer
)

func getterSequenceCompletion(statements []*shimast.Node) getterCompletion {
  result := getterNormal
  for _, statement := range statements {
    if result&getterNormal == 0 {
      break
    }
    result = result&^getterNormal | getterStatementCompletion(statement)
  }
  return result
}

func getterStatementCompletion(stmt *shimast.Node) getterCompletion {
  if stmt == nil {
    return getterNormal
  }
  switch stmt.Kind {
  case shimast.KindReturnStatement:
    if ret := stmt.AsReturnStatement(); ret != nil && ret.Expression != nil {
      return getterValueReturn
    }
    return getterBareReturn
  case shimast.KindThrowStatement:
    return getterThrow
  case shimast.KindBreakStatement:
    if branch := stmt.AsBreakStatement(); branch != nil && branch.Label != nil {
      return getterUnresolvedTransfer
    }
    return getterBreak
  case shimast.KindContinueStatement:
    if branch := stmt.AsContinueStatement(); branch != nil && branch.Label != nil {
      return getterUnresolvedTransfer
    }
    return getterContinue
  case shimast.KindBlock:
    return getterSequenceCompletion(stmt.Statements())
  case shimast.KindLabeledStatement:
    if label := stmt.AsLabeledStatement(); label != nil {
      return getterStatementCompletion(label.Statement)
    }
    return getterNormal
  case shimast.KindIfStatement:
    branch := stmt.AsIfStatement()
    if branch == nil {
      return getterNormal
    }
    if condition := stripParens(branch.Expression); condition != nil {
      if condition.Kind == shimast.KindTrueKeyword {
        return getterStatementCompletion(branch.ThenStatement)
      }
      if condition.Kind == shimast.KindFalseKeyword {
        return getterStatementCompletion(branch.ElseStatement)
      }
    }
    return getterStatementCompletion(branch.ThenStatement) | getterStatementCompletion(branch.ElseStatement)
  case shimast.KindSwitchStatement:
    return getterSwitchCompletion(stmt)
  case shimast.KindTryStatement:
    block := stmt.AsTryStatement()
    if block == nil {
      return getterNormal
    }
    result := getterStatementCompletion(block.TryBlock)
    if block.CatchClause != nil {
      clause := block.CatchClause.AsCatchClause()
      if clause == nil {
        return getterNormal
      }
      // Calls and expressions can throw even without an explicit throw node.
      result = result&^getterThrow | getterStatementCompletion(clause.Block)
    }
    if block.FinallyBlock != nil && result != 0 {
      final := getterStatementCompletion(block.FinallyBlock)
      if final&getterNormal == 0 {
        return final
      }
      return result | final&^getterNormal
    }
    return result
  case shimast.KindWhileStatement:
    loop := stmt.AsWhileStatement()
    if loop != nil {
      if condition := stripParens(loop.Expression); condition != nil && condition.Kind == shimast.KindFalseKeyword {
        return getterNormal
      }
      return getterLoopCompletion(loop.Statement, isConstantTrue(loop.Expression), false)
    }
  case shimast.KindDoStatement:
    loop := stmt.AsDoStatement()
    if loop != nil {
      return getterLoopCompletion(loop.Statement, isConstantTrue(loop.Expression), true)
    }
  case shimast.KindForStatement:
    loop := stmt.AsForStatement()
    if loop != nil {
      if condition := stripParens(loop.Condition); condition != nil && condition.Kind == shimast.KindFalseKeyword {
        return getterNormal
      }
      return getterLoopCompletion(loop.Statement, loop.Condition == nil || isConstantTrue(loop.Condition), false)
    }
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    if loop := stmt.AsForInOrOfStatement(); loop != nil {
      return getterLoopCompletion(loop.Statement, false, false)
    }
  }
  return getterNormal
}

func getterLoopCompletion(body *shimast.Node, endless, executesOnce bool) getterCompletion {
  result := getterStatementCompletion(body)
  normal := !endless && (!executesOnce || result&(getterNormal|getterContinue) != 0)
  if result&getterBreak != 0 {
    normal = true
  }
  result &^= getterNormal | getterBreak | getterContinue
  if normal {
    result |= getterNormal
  }
  return result
}

func getterSwitchCompletion(stmt *shimast.Node) getterCompletion {
  sw := stmt.AsSwitchStatement()
  if sw == nil || sw.CaseBlock == nil {
    return getterNormal
  }
  block := sw.CaseBlock.AsCaseBlock()
  if block == nil || block.Clauses == nil {
    return getterNormal
  }
  result, suffix := getterCompletion(0), getterNormal
  hasDefault := false
  for index := len(block.Clauses.Nodes) - 1; index >= 0; index-- {
    node := block.Clauses.Nodes[index]
    if node == nil {
      return getterNormal
    }
    clause := node.AsCaseOrDefaultClause()
    if clause == nil {
      return getterNormal
    }
    hasDefault = hasDefault || node.Kind == shimast.KindDefaultClause
    own := getterNormal
    if clause.Statements != nil {
      own = getterSequenceCompletion(clause.Statements.Nodes)
    }
    if own&getterNormal != 0 {
      own = own&^getterNormal | suffix
    }
    suffix = own
    result |= own
  }
  if !hasDefault || result&getterBreak != 0 {
    result |= getterNormal
  }
  return result &^ getterBreak
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
