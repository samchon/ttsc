// unicorn/prefer-classlist-toggle: an `if (cond) el.classList.add(name)
// else el.classList.remove(name)` block can be collapsed into a single
// `el.classList.toggle(name, cond)` call. The toggle form is shorter,
// avoids accidental drift between the two branches, and matches the
// spec-blessed shape for conditional class management.
//
// AST-only minimum-viable port: visit `IfStatement` and match when both
// branches contain a single `ExpressionStatement` of
// `X.classList.add(arg)` and `X.classList.remove(arg)` (in either
// order), with identical receiver text on `X.classList` and identical
// argument text. Textual identity uses `nodeText` so this works without
// the Checker; receivers that differ at the type level but share their
// spelling will still match (the rule's signal is the syntactic shape
// of the two-branch toggle).
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-classlist-toggle.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferClasslistToggle struct{}

func (unicornPreferClasslistToggle) Name() string { return "unicorn/prefer-classlist-toggle" }
func (unicornPreferClasslistToggle) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindIfStatement}
}
func (unicornPreferClasslistToggle) Check(ctx *Context, node *shimast.Node) {
	stmt := node.AsIfStatement()
	if stmt == nil || stmt.ThenStatement == nil || stmt.ElseStatement == nil {
		return
	}
	thenCall := classlistToggleSingleCall(stmt.ThenStatement)
	elseCall := classlistToggleSingleCall(stmt.ElseStatement)
	if thenCall == nil || elseCall == nil {
		return
	}
	thenMethod, thenReceiver, thenArg := classlistAddRemoveParts(thenCall)
	elseMethod, elseReceiver, elseArg := classlistAddRemoveParts(elseCall)
	if thenMethod == "" || elseMethod == "" {
		return
	}
	// One branch must be `add`, the other `remove` — order does not
	// matter; the toggle rewrite is symmetric.
	if !((thenMethod == "add" && elseMethod == "remove") ||
		(thenMethod == "remove" && elseMethod == "add")) {
		return
	}
	if nodeText(ctx.File, thenReceiver) != nodeText(ctx.File, elseReceiver) {
		return
	}
	if nodeText(ctx.File, thenArg) != nodeText(ctx.File, elseArg) {
		return
	}
	ctx.Report(node, "Prefer `classList.toggle(name, condition)` over manual `add`/`remove` branches.")
}

// classlistToggleSingleCall returns the single CallExpression inside a
// then/else branch — accepting either a bare ExpressionStatement or a
// Block wrapping exactly one ExpressionStatement. Returns nil for any
// other shape.
func classlistToggleSingleCall(branch *shimast.Node) *shimast.Node {
	if branch == nil {
		return nil
	}
	stmt := branch
	if branch.Kind == shimast.KindBlock {
		block := branch.AsBlock()
		if block == nil || block.Statements == nil || len(block.Statements.Nodes) != 1 {
			return nil
		}
		stmt = block.Statements.Nodes[0]
	}
	if stmt == nil || stmt.Kind != shimast.KindExpressionStatement {
		return nil
	}
	expr := stmt.AsExpressionStatement()
	if expr == nil || expr.Expression == nil {
		return nil
	}
	call := stripParens(expr.Expression)
	if call == nil || call.Kind != shimast.KindCallExpression {
		return nil
	}
	return call
}

// classlistAddRemoveParts pulls (method, receiver, arg) out of a
// `X.classList.add(arg)` / `X.classList.remove(arg)` call, where
// `receiver` is the `X.classList` chain (the property-access expression
// node) and `arg` is the single argument. Returns ("", nil, nil) for
// any other shape.
func classlistAddRemoveParts(call *shimast.Node) (string, *shimast.Node, *shimast.Node) {
	ce := call.AsCallExpression()
	if ce == nil || ce.Expression == nil || ce.Arguments == nil || len(ce.Arguments.Nodes) != 1 {
		return "", nil, nil
	}
	if ce.Expression.Kind != shimast.KindPropertyAccessExpression {
		return "", nil, nil
	}
	access := ce.Expression.AsPropertyAccessExpression()
	if access == nil {
		return "", nil, nil
	}
	method := identifierText(access.Name())
	if method != "add" && method != "remove" {
		return "", nil, nil
	}
	receiver := access.Expression
	if receiver == nil || receiver.Kind != shimast.KindPropertyAccessExpression {
		return "", nil, nil
	}
	receiverAccess := receiver.AsPropertyAccessExpression()
	if receiverAccess == nil || identifierText(receiverAccess.Name()) != "classList" {
		return "", nil, nil
	}
	return method, receiver, ce.Arguments.Nodes[0]
}

func init() {
	Register(unicornPreferClasslistToggle{})
}
