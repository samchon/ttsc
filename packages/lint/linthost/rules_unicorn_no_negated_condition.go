// unicorn/no-negated-condition: a negated condition with an `else`
// branch forces the reader to mentally invert the test before they can
// pair branches with outcomes. Swapping the two branches and dropping
// the negation reads in source order. The rule fires on `if` / `else`
// pairs and on ternaries where both branches are present.
//
// AST-only: visit `KindIfStatement` and `KindConditionalExpression`.
// Match when the condition (after `stripParens`) is either a `!`
// prefix-unary expression or a `!=` / `!==` binary expression AND the
// other branch is also present. Fire on the if / ternary node.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-negated-condition.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoNegatedCondition struct{}

func (unicornNoNegatedCondition) Name() string { return "unicorn/no-negated-condition" }
func (unicornNoNegatedCondition) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindIfStatement, shimast.KindConditionalExpression}
}
func (unicornNoNegatedCondition) Check(ctx *Context, node *shimast.Node) {
	var condition *shimast.Node
	switch node.Kind {
	case shimast.KindIfStatement:
		stmt := node.AsIfStatement()
		if stmt == nil || stmt.ElseStatement == nil {
			return
		}
		// An `else if` chain (else is itself an IfStatement) reads
		// fine after inversion only when the else has its own else;
		// otherwise inverting reshapes the chain. Keep the rule
		// conservative and only fire when else is a Block.
		if stmt.ElseStatement.Kind == shimast.KindIfStatement {
			return
		}
		condition = stmt.Expression
	case shimast.KindConditionalExpression:
		cond := node.AsConditionalExpression()
		if cond == nil || cond.WhenTrue == nil || cond.WhenFalse == nil {
			return
		}
		condition = cond.Condition
	}
	if condition == nil {
		return
	}
	condition = stripParens(condition)
	if condition == nil {
		return
	}
	if !unicornNoNegatedConditionIsNegated(condition) {
		return
	}
	ctx.Report(node, "Avoid negated conditions in `if` / `else` and ternaries when the positive form is shorter.")
}

// unicornNoNegatedConditionIsNegated reports whether `node` is a `!`
// prefix-unary expression or a `!=` / `!==` binary expression — the
// two shapes the rule treats as "negated".
func unicornNoNegatedConditionIsNegated(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	switch node.Kind {
	case shimast.KindPrefixUnaryExpression:
		prefix := node.AsPrefixUnaryExpression()
		return prefix != nil && prefix.Operator == shimast.KindExclamationToken
	case shimast.KindBinaryExpression:
		bin := node.AsBinaryExpression()
		if bin == nil || bin.OperatorToken == nil {
			return false
		}
		switch bin.OperatorToken.Kind {
		case shimast.KindExclamationEqualsToken,
			shimast.KindExclamationEqualsEqualsToken:
			return true
		}
	}
	return false
}

func init() {
	Register(unicornNoNegatedCondition{})
}
