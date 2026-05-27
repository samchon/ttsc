// noElseReturn: when an `if` block ends in a `return` / `throw` /
// `break` / `continue` statement, the matching `else` block is
// redundant — control already left the function (or loop), so flatten
// the `else` body into the surrounding scope to keep one less level of
// nesting and one less branch to read.
// https://eslint.org/docs/latest/rules/no-else-return
//
// AST-only: each visited `IfStatement` whose `ThenStatement` provably
// terminates control flow on every branch reports on the `else`
// keyword. A `then` branch terminates when:
//
//   - it is itself a terminating statement (`return`, `throw`, etc.), or
//   - it is a `Block` whose final statement terminates AND every
//     `if/else if/else` chain inside it terminates on every leaf, or
//   - it is an `IfStatement` whose `then` AND `else` both terminate
//     (chained early returns).
//
// The analysis is conservative; ambiguous shapes (e.g. an `if` with no
// `else`, or a loop with `break` only) are left alone.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noElseReturn struct{}

func (noElseReturn) Name() string { return "no-else-return" }
func (noElseReturn) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindIfStatement}
}
func (noElseReturn) Check(ctx *Context, node *shimast.Node) {
	ifStmt := node.AsIfStatement()
	if ifStmt == nil || ifStmt.ElseStatement == nil {
		return
	}
	if !noElseReturnTerminates(ifStmt.ThenStatement) {
		return
	}
	ctx.Report(ifStmt.ElseStatement, "Remove the `else` — the preceding branch already terminates.")
}

func noElseReturnTerminates(stmt *shimast.Node) bool {
	if stmt == nil {
		return false
	}
	switch stmt.Kind {
	case shimast.KindReturnStatement,
		shimast.KindThrowStatement,
		shimast.KindBreakStatement,
		shimast.KindContinueStatement:
		return true
	case shimast.KindBlock:
		block := stmt.AsBlock()
		if block == nil || block.Statements == nil {
			return false
		}
		stmts := block.Statements.Nodes
		if len(stmts) == 0 {
			return false
		}
		return noElseReturnTerminates(stmts[len(stmts)-1])
	case shimast.KindIfStatement:
		inner := stmt.AsIfStatement()
		if inner == nil || inner.ElseStatement == nil {
			return false
		}
		return noElseReturnTerminates(inner.ThenStatement) && noElseReturnTerminates(inner.ElseStatement)
	}
	return false
}

func init() {
	Register(noElseReturn{})
}
