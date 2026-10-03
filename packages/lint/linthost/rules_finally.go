package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noUnsafeFinally: `return` / `break` / `continue` / `throw` inside a
// `finally` clause silently overrides the in-flight exception or value.
// https://eslint.org/docs/latest/rules/no-unsafe-finally
type noUnsafeFinally struct{}

func (noUnsafeFinally) Name() string { return "no-unsafe-finally" }
func (noUnsafeFinally) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindReturnStatement,
    shimast.KindBreakStatement,
    shimast.KindContinueStatement,
    shimast.KindThrowStatement,
  }
}
func (noUnsafeFinally) Check(ctx *Context, node *shimast.Node) {
  finallyAncestor := walkToFinally(node)
  if finallyAncestor == nil {
    return
  }
  keyword := keywordOfControl(node)
  ctx.Report(node, "Unsafe usage of "+keyword+".")
}

// walkToFinally walks the parent chain from node upward looking for a
// `finally` block. It returns the Block node that IS the finally clause when
// found, or nil when the search exits through a function boundary (making any
// control-flow transfer target something outside the finally block) or when no
// finally block is found at all.
//
// A `break` or `continue` that targets an inner loop or switch INSIDE the
// finally block is safe — it does not escape the finally — so the walk stops
// early and returns nil in that case.
func walkToFinally(node *shimast.Node) *shimast.Node {
  cur := node.Parent
  for cur != nil {
    if isFunctionLikeKind(cur) || cur.Kind == shimast.KindSourceFile {
      return nil
    }
    if cur.Kind == shimast.KindBlock {
      grand := cur.Parent
      if grand != nil && grand.Kind == shimast.KindTryStatement {
        try := grand.AsTryStatement()
        if try != nil && try.FinallyBlock == cur {
          return cur
        }
      }
    }
    // A jump whose target lies inside the finally block does not escape it.
    // An unlabeled `break` targets the nearest loop or switch, an unlabeled
    // `continue` the nearest loop only (a switch is not a continue target),
    // and a labeled jump the labeled statement carrying its label.
    if finallyJumpTargetsAncestor(node, cur) {
      return nil
    }
    cur = cur.Parent
  }
  return nil
}

// finallyJumpTargetsAncestor reports whether the `break` or `continue` at
// `node` is resolved by `ancestor`, so the jump stays inside the construct that
// `ancestor` heads. Other statements never resolve a jump.
func finallyJumpTargetsAncestor(node, ancestor *shimast.Node) bool {
  var label *shimast.Node
  switch node.Kind {
  case shimast.KindBreakStatement:
    if statement := node.AsBreakStatement(); statement != nil {
      label = statement.Label
    }
  case shimast.KindContinueStatement:
    if statement := node.AsContinueStatement(); statement != nil {
      label = statement.Label
    }
  default:
    return false
  }
  if label != nil {
    if ancestor.Kind != shimast.KindLabeledStatement {
      return false
    }
    labeled := ancestor.AsLabeledStatement()
    return labeled != nil && identifierText(labeled.Label) == identifierText(label)
  }
  switch ancestor.Kind {
  case shimast.KindForStatement,
    shimast.KindForInStatement,
    shimast.KindForOfStatement,
    shimast.KindWhileStatement,
    shimast.KindDoStatement:
    return true
  case shimast.KindSwitchStatement:
    return node.Kind == shimast.KindBreakStatement
  }
  return false
}

// keywordOfControl returns the control-flow keyword string for the given
// statement node, used to build the diagnostic message text.
func keywordOfControl(node *shimast.Node) string {
  switch node.Kind {
  case shimast.KindReturnStatement:
    return "return"
  case shimast.KindBreakStatement:
    return "break"
  case shimast.KindContinueStatement:
    return "continue"
  case shimast.KindThrowStatement:
    return "throw"
  }
  return "control flow"
}

// noUselessCatch: `catch (err) { throw err; }` adds no behavior. Without a
// `finally` the whole try statement is a wrapper; with one, only the catch
// clause is redundant, because the finally block runs on the rethrow either way.
// https://eslint.org/docs/latest/rules/no-useless-catch
type noUselessCatch struct{}

func (noUselessCatch) Name() string           { return "no-useless-catch" }
func (noUselessCatch) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindCatchClause} }
func (noUselessCatch) Check(ctx *Context, node *shimast.Node) {
  clause := node.AsCatchClause()
  if clause == nil || clause.VariableDeclaration == nil || clause.Block == nil {
    return
  }
  binding := clause.VariableDeclaration.AsVariableDeclaration()
  if binding == nil {
    return
  }
  bindingName := identifierText(binding.Name())
  if bindingName == "" {
    return
  }
  block := clause.Block.AsBlock()
  if block == nil || block.Statements == nil || len(block.Statements.Nodes) != 1 {
    return
  }
  stmt := block.Statements.Nodes[0]
  if stmt == nil || stmt.Kind != shimast.KindThrowStatement {
    return
  }
  throw := stmt.AsThrowStatement()
  if throw == nil {
    return
  }
  if identifierText(throw.Expression) != bindingName {
    return
  }
  // With a `finally` block the try statement still does work, so only the
  // catch clause is redundant.
  if try := node.Parent; try != nil && try.Kind == shimast.KindTryStatement {
    tryStmt := try.AsTryStatement()
    if tryStmt != nil && tryStmt.FinallyBlock != nil {
      ctx.Report(node, "Unnecessary catch clause.")
      return
    }
  }
  ctx.Report(node, "Unnecessary try/catch wrapper.")
}

func init() {
  Register(noUnsafeFinally{})
  Register(noUselessCatch{})
}
