// noUnreachable reports statements that follow an unconditional control-
// flow terminator inside the same statement list. After `return`, `throw`,
// `break`, or `continue` the surrounding block exits, so any later
// statement in the list is dead code — almost always a leftover from
// refactoring.
//
// Conservative baseline: only the immediate statement list of a Block,
// SourceFile, or ModuleBlock is inspected; nested conditionals and loops
// are left to a real control-flow pass. Hoistable function declarations
// following the terminator are exempt because they are hoisted above the
// unreachable point and remain callable from earlier statements.
// https://eslint.org/docs/latest/rules/no-unreachable
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noUnreachable struct{}

func (noUnreachable) Name() string { return "no-unreachable" }
func (noUnreachable) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindBlock,
    shimast.KindSourceFile,
    shimast.KindModuleBlock,
  }
}
func (noUnreachable) Check(ctx *Context, node *shimast.Node) {
  stmts := node.Statements()
  if len(stmts) < 2 {
    return
  }
  terminated := false
  // Consecutive unreachable statements are one dead region, reported once over
  // the whole run as ESLint does; an exempt declaration ends the run.
  var run []*shimast.Node
  flush := func() {
    if len(run) == 0 {
      return
    }
    first, last := run[0], run[len(run)-1]
    run = nil
    if first == last {
      ctx.Report(first, "Unreachable code.")
      return
    }
    start, _ := tokenRange(ctx.File, first)
    _, end := tokenRange(ctx.File, last)
    if start < 0 || end < start {
      ctx.Report(first, "Unreachable code.")
      return
    }
    ctx.ReportRange(start, end, "Unreachable code.")
  }
  for _, stmt := range stmts {
    if stmt == nil {
      continue
    }
    if terminated {
      if isHoistableDeclaration(stmt) || isDeclarationWithoutRuntimeEffect(stmt) {
        flush()
        continue
      }
      run = append(run, stmt)
      continue
    }
    if isControlFlowTerminator(stmt) {
      terminated = true
    }
  }
  flush()
}

// isDeclarationWithoutRuntimeEffect reports whether `stmt` declares something
// that exists regardless of control flow and runs nothing: a `var` statement
// with no initializer (its binding hoists) and the type-only `interface` and
// `type` declarations. ESLint's no-unreachable exempts the first kind for the
// same reason, and a type declaration has no code path at all.
func isDeclarationWithoutRuntimeEffect(stmt *shimast.Node) bool {
  if stmt == nil {
    return false
  }
  switch stmt.Kind {
  case shimast.KindInterfaceDeclaration, shimast.KindTypeAliasDeclaration:
    return true
  case shimast.KindVariableStatement:
    vs := stmt.AsVariableStatement()
    if vs == nil || vs.DeclarationList == nil || !shimast.IsVar(vs.DeclarationList) {
      return false
    }
    list := vs.DeclarationList.AsVariableDeclarationList()
    if list == nil || list.Declarations == nil {
      return false
    }
    for _, declaration := range list.Declarations.Nodes {
      if declaration != nil {
        if v := declaration.AsVariableDeclaration(); v != nil && v.Initializer != nil {
          return false
        }
      }
    }
    return true
  }
  return false
}

// isControlFlowTerminator reports whether `stmt` is one of the four
// statement kinds that unconditionally leave the surrounding block:
// `return`, `throw`, `break`, `continue`.
func isControlFlowTerminator(stmt *shimast.Node) bool {
  if stmt == nil {
    return false
  }
  switch stmt.Kind {
  case shimast.KindReturnStatement,
    shimast.KindThrowStatement,
    shimast.KindBreakStatement,
    shimast.KindContinueStatement:
    return true
  }
  return false
}

// isHoistableDeclaration reports whether `stmt` is a declaration whose
// binding survives even when it textually follows a terminator. Function
// declarations hoist to the top of their containing scope, so a
// `function f() {…}` after a `return` is still callable from earlier
// statements and is not dead code in the ESLint sense.
func isHoistableDeclaration(stmt *shimast.Node) bool {
  return stmt != nil && stmt.Kind == shimast.KindFunctionDeclaration
}

func init() {
  Register(noUnreachable{})
}
