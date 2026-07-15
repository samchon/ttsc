// guardForIn: `for (key in obj)` walks the prototype chain and yields
// every enumerable name, inherited or own. Most authors only ever care
// about own keys, so an unguarded body silently leaks work onto
// prototype-chain entries someone else attached.
//
// Ported from ESLint's `guard-for-in`, the check is purely STRUCTURAL:
// it never inspects what the guard `if` tests, only the SHAPE of the
// loop body. The body is accepted when it is one of five shapes,
// mirroring upstream's ordered early-returns exactly:
//
//  1. an empty statement (`for (k in o);`);
//  2. a bare `if` statement (`for (k in o) if (...) ...;`);
//  3. an empty block (`{}`);
//  4. a block whose sole statement is an `if`;
//  5. a block whose leading statement is an `if` whose consequent is a
//     `continue` (bare, or a block containing only `continue`).
//
// Anything else is reported. Because the condition is never examined,
// `if (obj.hasOwnProperty(key))`, `if (Object.hasOwn(obj, key))`,
// `if (cond)`, and `if (key.startsWith("_")) continue;` are all
// accepted, matching ESLint.
// https://eslint.org/docs/latest/rules/guard-for-in
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type guardForIn struct{}

func (guardForIn) Name() string           { return "guard-for-in" }
func (guardForIn) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindForInStatement} }
func (guardForIn) Check(ctx *Context, node *shimast.Node) {
  stmt := node.AsForInOrOfStatement()
  if stmt == nil || stmt.Statement == nil {
    return
  }
  if isGuardedForInBody(stmt.Statement) {
    return
  }
  ctx.Report(node, "The body of a `for...in` should be wrapped in an `if` statement to filter unwanted properties from the prototype.")
}

// isGuardedForInBody reports whether a `for...in` loop body has one of
// the five structural shapes ESLint's guard-for-in accepts. It mirrors
// upstream's ordered early-returns and deliberately never inspects the
// guard condition.
func isGuardedForInBody(body *shimast.Node) bool {
  switch body.Kind {
  case shimast.KindEmptyStatement:
    // `for (k in o);` — an empty body cannot leak inherited keys.
    return true
  case shimast.KindIfStatement:
    // `for (k in o) if (...) ...;` — a bare `if` body is itself the
    // guard, whatever it tests.
    return true
  case shimast.KindBlock:
    // Fall through to the block-shape analysis below.
  default:
    return false
  }

  block := body.AsBlock()
  if block == nil || block.Statements == nil {
    // A block with no statement list behaves like an empty block.
    return true
  }
  stmts := block.Statements.Nodes
  // Empty block.
  if len(stmts) == 0 {
    return true
  }
  // Every remaining accepted shape opens with an `if`.
  lead := stmts[0]
  if lead == nil || lead.Kind != shimast.KindIfStatement {
    return false
  }
  // Block whose sole statement is an `if`.
  if len(stmts) == 1 {
    return true
  }
  // Block that opens with an `if` whose consequent is a `continue`, so
  // the statements after it run only for retained keys.
  ifStmt := lead.AsIfStatement()
  if ifStmt == nil {
    return false
  }
  return isContinueConsequent(ifStmt.ThenStatement)
}

// isContinueConsequent reports whether an `if` consequent is a
// `continue` statement, either bare (`continue;`) or a block whose sole
// statement is `continue;`. Mirrors ESLint's check on the leading
// guard's consequent.
func isContinueConsequent(consequent *shimast.Node) bool {
  if consequent == nil {
    return false
  }
  if consequent.Kind == shimast.KindContinueStatement {
    return true
  }
  if consequent.Kind != shimast.KindBlock {
    return false
  }
  block := consequent.AsBlock()
  if block == nil || block.Statements == nil || len(block.Statements.Nodes) != 1 {
    return false
  }
  only := block.Statements.Nodes[0]
  return only != nil && only.Kind == shimast.KindContinueStatement
}

func init() {
  Register(guardForIn{})
}
