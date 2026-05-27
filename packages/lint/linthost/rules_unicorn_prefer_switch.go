// unicorn/prefer-switch: a long `if (x === "a") {…} else if (x === "b")
// {…} else if (x === "c") {…}` ladder repeats both the discriminant and
// the equality check on every branch; `switch (x)` collapses the cascade
// into one labelled lookup and signals intent ("dispatch on the value of
// x") more directly. The cliff for the rewrite is at three branches —
// fewer than that, the if-cascade and the switch are about equally
// readable.
//
// AST-only minimum-viable port: visit `IfStatement` and only fire on
// the outermost `if` of a chain. Walk the else-chain and require it to
// contain THREE OR MORE `else if` clauses whose condition is a
// `BinaryExpression` with `===` (or `==`) AND whose left operand is
// textually identical to the outermost if's left operand AND whose
// right operand is a string-or-numeric literal. The outermost `if`
// itself must satisfy the same shape. The shape constraint is
// intentionally conservative — switch can only dispatch on equality
// against literal labels.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-switch.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferSwitch struct{}

func (unicornPreferSwitch) Name() string { return "unicorn/prefer-switch" }
func (unicornPreferSwitch) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindIfStatement}
}
func (unicornPreferSwitch) Check(ctx *Context, node *shimast.Node) {
	// Only fire on the outermost if — if our parent is also an
	// `IfStatement` whose else-branch is `node`, this is a middle of the
	// chain and a higher-up visit will report it once.
	if node.Parent != nil && node.Parent.Kind == shimast.KindIfStatement {
		parent := node.Parent.AsIfStatement()
		if parent != nil && parent.ElseStatement == node {
			return
		}
	}
	stmt := node.AsIfStatement()
	if stmt == nil || stmt.Expression == nil {
		return
	}
	discriminant, ok := unicornPreferSwitchDiscriminant(ctx, stmt.Expression)
	if !ok {
		return
	}
	// Count the outermost `if` plus every well-shaped `else if` that
	// compares against the same discriminant.
	branches := 1
	cur := stmt.ElseStatement
	for cur != nil && cur.Kind == shimast.KindIfStatement {
		inner := cur.AsIfStatement()
		if inner == nil || inner.Expression == nil {
			return
		}
		next, ok := unicornPreferSwitchDiscriminant(ctx, inner.Expression)
		if !ok || next != discriminant {
			return
		}
		branches++
		cur = inner.ElseStatement
	}
	if branches >= 3 {
		ctx.Report(node, "Three or more `else if` clauses comparing the same value should be a `switch`.")
	}
}

// unicornPreferSwitchDiscriminant returns the textual form of the left
// operand of an `===`/`==` comparison against a string-or-numeric
// literal. Returns ok=false for any other shape.
func unicornPreferSwitchDiscriminant(ctx *Context, expr *shimast.Node) (string, bool) {
	expr = stripParens(expr)
	if expr == nil || expr.Kind != shimast.KindBinaryExpression {
		return "", false
	}
	bin := expr.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil {
		return "", false
	}
	switch bin.OperatorToken.Kind {
	case shimast.KindEqualsEqualsEqualsToken, shimast.KindEqualsEqualsToken:
	default:
		return "", false
	}
	right := stripParens(bin.Right)
	if right == nil {
		return "", false
	}
	switch right.Kind {
	case shimast.KindStringLiteral, shimast.KindNumericLiteral:
	default:
		return "", false
	}
	left := stripParens(bin.Left)
	if left == nil {
		return "", false
	}
	return nodeText(ctx.File, left), true
}

func init() {
	Register(unicornPreferSwitch{})
}
