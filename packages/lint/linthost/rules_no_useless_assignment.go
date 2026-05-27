// noUselessAssignment reports an assignment whose value is immediately
// overwritten by the very next statement without an intervening read of
// the same identifier. `x = 1; x = 2;` writes the first value just to
// discard it — almost always a leftover from refactoring.
// https://eslint.org/docs/latest/rules/no-useless-assignment
//
// Conservative baseline: only the syntactically adjacent
// ExpressionStatement / ExpressionStatement pair is inspected, and only
// when both left-hand sides are bare identifiers with the same name. A
// real dead-store analysis would track reads across branches and inside
// the right-hand expression; the simpler textual match catches the
// common copy-paste case without needing full control-flow.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noUselessAssignment struct{}

func (noUselessAssignment) Name() string { return "no-useless-assignment" }
func (noUselessAssignment) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBlock}
}
func (noUselessAssignment) Check(ctx *Context, node *shimast.Node) {
	block := node.AsBlock()
	if block == nil || block.Statements == nil {
		return
	}
	stmts := block.Statements.Nodes
	if len(stmts) < 2 {
		return
	}
	for i := 0; i+1 < len(stmts); i++ {
		firstName, firstAssign := plainAssignmentTarget(stmts[i])
		if firstName == "" {
			continue
		}
		secondName, _ := plainAssignmentTarget(stmts[i+1])
		if secondName != firstName {
			continue
		}
		// If the second statement's RHS reads the first target, the
		// first write is load-bearing — skip.
		if assignmentRhsReadsIdent(stmts[i+1], firstName) {
			continue
		}
		ctx.Report(firstAssign, "Assignment to `"+firstName+"` is immediately overwritten without being read.")
	}
}

// plainAssignmentTarget returns the identifier name on the left-hand
// side of `stmt` when it is an `ExpressionStatement` wrapping a plain
// `<ident> = <expr>` assignment. Anything else (compound assignment,
// destructuring target, property access, non-statement) returns "".
func plainAssignmentTarget(stmt *shimast.Node) (string, *shimast.Node) {
	if stmt == nil || stmt.Kind != shimast.KindExpressionStatement {
		return "", nil
	}
	expr := stmt.AsExpressionStatement()
	if expr == nil || expr.Expression == nil {
		return "", nil
	}
	inner := stripParens(expr.Expression)
	if inner == nil || inner.Kind != shimast.KindBinaryExpression {
		return "", nil
	}
	bin := inner.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil || bin.OperatorToken.Kind != shimast.KindEqualsToken {
		return "", nil
	}
	name := identifierText(stripParens(bin.Left))
	if name == "" {
		return "", nil
	}
	return name, stmt
}

// assignmentRhsReadsIdent reports whether the second statement's
// assignment right-hand side references the same identifier name. A
// `x = x + 1` style update reads the previous value, so the prior
// assignment is not actually dead.
func assignmentRhsReadsIdent(stmt *shimast.Node, name string) bool {
	if stmt == nil || stmt.Kind != shimast.KindExpressionStatement {
		return false
	}
	expr := stmt.AsExpressionStatement()
	if expr == nil || expr.Expression == nil {
		return false
	}
	inner := stripParens(expr.Expression)
	if inner == nil || inner.Kind != shimast.KindBinaryExpression {
		return false
	}
	bin := inner.AsBinaryExpression()
	if bin == nil || bin.Right == nil {
		return false
	}
	found := false
	var walk func(n *shimast.Node)
	walk = func(n *shimast.Node) {
		if found || n == nil {
			return
		}
		if n.Kind == shimast.KindIdentifier && identifierText(n) == name {
			found = true
			return
		}
		n.ForEachChild(func(child *shimast.Node) bool {
			walk(child)
			return false
		})
	}
	walk(bin.Right)
	return found
}

func init() {
	Register(noUselessAssignment{})
}
