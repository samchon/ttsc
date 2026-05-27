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
	for _, stmt := range stmts {
		if stmt == nil {
			continue
		}
		if terminated && !isHoistableDeclaration(stmt) {
			ctx.Report(stmt, "Unreachable code.")
			continue
		}
		if isControlFlowTerminator(stmt) {
			terminated = true
		}
	}
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
