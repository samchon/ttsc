package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-unsafe-finally: `return` / `break` / `continue` / `throw` inside a
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
    // `break` / `continue` inside an inner loop within finally
    // targets that loop and is therefore safe.
    switch cur.Kind {
    case shimast.KindForStatement,
      shimast.KindForInStatement,
      shimast.KindForOfStatement,
      shimast.KindWhileStatement,
      shimast.KindDoStatement,
      shimast.KindSwitchStatement:
      if node.Kind == shimast.KindBreakStatement || node.Kind == shimast.KindContinueStatement {
        return nil
      }
    }
    cur = cur.Parent
  }
  return nil
}

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

// no-useless-catch: `catch (err) { throw err; }` adds no behavior.
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
  // Ignore when the surrounding try-catch has a `finally` block — the
  // catch may exist solely to keep the finally semantics intact.
  if try := node.Parent; try != nil && try.Kind == shimast.KindTryStatement {
    tryStmt := try.AsTryStatement()
    if tryStmt != nil && tryStmt.FinallyBlock != nil {
      return
    }
  }
  ctx.Report(node, "Unnecessary try/catch wrapper.")
}

func init() {
  Register(noUnsafeFinally{})
  Register(noUselessCatch{})
}
