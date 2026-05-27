// curly: require all `if`/`else`/`while`/`for`/`do` bodies to use
// a block (`{ ... }`) rather than a single bare statement. The
// shorthand `if (cond) foo();` form silently widens its body when a
// second statement is added later, so the "all" default flags every
// non-Block body for consistency.
// https://eslint.org/docs/latest/rules/curly
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type curly struct{}

func (curly) Name() string { return "curly" }
func (curly) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindIfStatement,
		shimast.KindWhileStatement,
		shimast.KindDoStatement,
		shimast.KindForStatement,
		shimast.KindForInStatement,
		shimast.KindForOfStatement,
	}
}
func (curly) Check(ctx *Context, node *shimast.Node) {
	switch node.Kind {
	case shimast.KindIfStatement:
		stmt := node.AsIfStatement()
		if stmt == nil {
			return
		}
		curlyReportNonBlock(ctx, stmt.ThenStatement, "if")
		// Allow `else if (...)` — the else branch carries another
		// IfStatement that is itself visited and reported separately.
		if stmt.ElseStatement != nil && stmt.ElseStatement.Kind != shimast.KindIfStatement {
			curlyReportNonBlock(ctx, stmt.ElseStatement, "else")
		}
	case shimast.KindWhileStatement:
		if stmt := node.AsWhileStatement(); stmt != nil {
			curlyReportNonBlock(ctx, stmt.Statement, "while")
		}
	case shimast.KindDoStatement:
		if stmt := node.AsDoStatement(); stmt != nil {
			curlyReportNonBlock(ctx, stmt.Statement, "do")
		}
	case shimast.KindForStatement:
		if stmt := node.AsForStatement(); stmt != nil {
			curlyReportNonBlock(ctx, stmt.Statement, "for")
		}
	case shimast.KindForInStatement, shimast.KindForOfStatement:
		if stmt := node.AsForInOrOfStatement(); stmt != nil {
			curlyReportNonBlock(ctx, stmt.Statement, "for")
		}
	}
}

// curlyReportNonBlock reports `body` when it is a single bare statement
// instead of a Block. A nil body means there is nothing to wrap (e.g. an
// IfStatement with no else clause), so it is silently skipped.
func curlyReportNonBlock(ctx *Context, body *shimast.Node, keyword string) {
	if body == nil || body.Kind == shimast.KindBlock {
		return
	}
	ctx.Report(body, "Expected { after '"+keyword+"' condition.")
}

func init() {
	Register(curly{})
}
